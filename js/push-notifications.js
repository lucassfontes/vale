(function () {
  'use strict';

  const cfg = window.VALLE_SUPABASE_CONFIG || {};
  const vapidPublicKey = String(cfg.vapidPublicKey || '').trim();
  const $ = (id) => document.getElementById(id);

  function isNativeAndroid() {
    try {
      return !!window.ValleAndroid && typeof window.ValleAndroid.isNativeApp === 'function' && window.ValleAndroid.isNativeApp();
    } catch (_) {
      return false;
    }
  }

  function supported() {
    if (isNativeAndroid()) return true;
    return window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  function base64UrlToUint8Array(value) {
    const padding = '='.repeat((4 - value.length % 4) % 4);
    const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
  }

  function setStatus(message, type) {
    const el = $('pushNotificationStatus');
    if (!el) return;
    el.className = `alert py-2 px-3 mb-3 alert-${type || 'secondary'}`;
    el.textContent = message;
  }

  async function getRegistration() {
    const registration = await navigator.serviceWorker.ready;
    if (!registration.active) throw new Error('O serviço de notificações ainda não está ativo.');
    return registration;
  }

  async function saveSubscription(subscription) {
    const cloud = window.ValleCloud;
    if (!cloud?.profile?.id) throw new Error('Entre no sistema antes de ativar as notificações.');
    const client = cloud.getClient();
    if (!client) throw new Error('Supabase não configurado.');

    if (cloud.profile.role !== 'service') {
      throw new Error('As notificações de vales estão disponíveis somente para usuários de serviço.');
    }

    const sessionUserId = cloud.profile.session_user_id;
    if (!sessionUserId) throw new Error('Este usuário de serviço não está vinculado a uma sessão válida.');

    const json = subscription.toJSON();
    const payload = {
      user_id: cloud.profile.id,
      session_user_id: sessionUserId,
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      user_agent: navigator.userAgent.slice(0, 500),
      enabled: true,
      updated_at: new Date().toISOString()
    };

    const { error } = await client.from('push_subscriptions').upsert(payload, { onConflict: 'endpoint' });
    if (error) throw error;
  }

  async function nativeConfig() {
    const cloud = window.ValleCloud;
    if (!cloud?.profile?.id) throw new Error('Entre no sistema antes de ativar as notificações.');
    if (cloud.profile.role !== 'service') throw new Error('As notificações de vales estão disponíveis somente para usuários de serviço.');
    if (!cloud.profile.session_user_id) throw new Error('Este usuário de serviço não está vinculado a uma sessão válida.');

    const client = cloud.getClient?.();
    if (!client) throw new Error('Supabase não configurado.');
    const { data, error } = await client.auth.getSession();
    if (error || !data?.session?.access_token || !data?.session?.refresh_token) {
      throw new Error('Sua sessão expirou. Entre novamente no VALLE para ativar as notificações.');
    }

    return {
      supabaseUrl: cfg.url,
      anonKey: cfg.anonKey,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      userId: cloud.profile.id,
      sessionUserId: cloud.profile.session_user_id,
      role: cloud.profile.role,
      sessionName: cloud.sessionProfile?.name || 'Sessão',
      validUntil: cloud.sessionProfile?.valid_until || ''
    };
  }

  async function activateNative() {
    const config = await nativeConfig();
    setStatus('Ativando notificações nativas neste Android…', 'info');
    window.ValleAndroid.activateNativeNotifications(JSON.stringify(config));
    setTimeout(() => refresh(), 800);
    setTimeout(() => refresh(), 2200);
  }

  async function activateWeb() {
    if (!vapidPublicKey) throw new Error('A chave pública VAPID ainda não foi configurada.');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('A permissão de notificações não foi concedida.');

    setStatus('Ativando notificações neste aparelho…', 'info');
    const registration = await getRegistration();
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(vapidPublicKey)
      });
    }
    await saveSubscription(subscription);
    setStatus('Notificações ativadas neste aparelho. Você receberá avisos mesmo com o VALLE fechado.', 'success');
    await refresh();
  }

  async function activate() {
    try {
      if (!supported()) throw new Error('Este aparelho não oferece notificações compatíveis.');
      if (isNativeAndroid()) await activateNative();
      else await activateWeb();
    } catch (error) {
      console.error(error);
      setStatus(error.message || 'Não foi possível ativar as notificações.', 'danger');
    }
  }

  async function deactivateNative() {
    window.ValleAndroid.deactivateNativeNotifications();
    setStatus('Notificações desativadas neste aparelho.', 'secondary');
    setTimeout(() => refresh(), 300);
  }

  async function deactivateWeb() {
    const registration = await getRegistration();
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const client = window.ValleCloud?.getClient?.();
      if (client) await client.from('push_subscriptions').update({ enabled: false, updated_at: new Date().toISOString() }).eq('endpoint', subscription.endpoint);
      await subscription.unsubscribe();
    }
    setStatus('Notificações desativadas neste aparelho.', 'secondary');
    await refresh();
  }

  async function deactivate() {
    try {
      if (isNativeAndroid()) await deactivateNative();
      else await deactivateWeb();
    } catch (error) {
      setStatus(error.message || 'Não foi possível desativar as notificações.', 'danger');
    }
  }

  async function testNotification() {
    try {
      if (isNativeAndroid()) {
        if (!window.ValleAndroid.areNativeNotificationsEnabled()) throw new Error('Ative as notificações primeiro.');
        window.ValleAndroid.testNativeNotification();
        return;
      }

      if (Notification.permission !== 'granted') throw new Error('Ative as notificações primeiro.');
      const registration = await getRegistration();
      await registration.showNotification('VALLE — teste de notificação', {
        body: 'As notificações estão funcionando neste celular.',
        icon: './icons/android-chrome-192x192.png',
        badge: './icons/favicon-48x48.png',
        tag: 'valle-test',
        data: { url: './index.html#notificacoes' }
      });
    } catch (error) {
      setStatus(error.message || 'Não foi possível testar a notificação.', 'danger');
    }
  }

  function updateButtons(active) {
    const activateBtn = $('activatePushNotifications');
    const testBtn = $('testPushNotifications');
    if (!activateBtn) return;

    activateBtn.classList.remove('d-none');
    activateBtn.disabled = false;
    activateBtn.classList.toggle('is-active', active);
    activateBtn.classList.toggle('btn-success', !active);
    activateBtn.classList.toggle('btn-outline-danger', active);
    activateBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
    activateBtn.dataset.notificationActive = active ? 'true' : 'false';
    activateBtn.innerHTML = active
      ? '<i class="bi bi-bell-slash me-1"></i><span>DESATIVAR NOTIFICAÇÕES</span>'
      : '<i class="bi bi-bell-fill me-1"></i><span>ATIVAR NOTIFICAÇÕES</span>';

    if (testBtn) {
      testBtn.disabled = !active;
      testBtn.setAttribute('aria-disabled', active ? 'false' : 'true');
      testBtn.classList.toggle('is-disabled', !active);
    }
  }

  async function refreshNative() {
    const profile = window.ValleCloud?.profile;
    const activateBtn = $('activatePushNotifications');
    const testBtn = $('testPushNotifications');
    if (!activateBtn) return;

    if (profile?.role && profile.role !== 'service') {
      activateBtn.classList.add('d-none');
      if (testBtn) {
        testBtn.disabled = true;
        testBtn.setAttribute('aria-disabled', 'true');
        testBtn.classList.add('is-disabled');
      }
      setStatus('O usuário de sessão não recebe notificações dos vales. Os avisos são enviados somente aos usuários de serviço desta sessão.', 'secondary');
      return;
    }

    if (!profile?.id) {
      updateButtons(false);
      setStatus('Entre com um usuário de serviço para ativar as notificações.', 'secondary');
      return;
    }

    let active = false;
    let configuredForCurrentUser = false;
    let permission = 'prompt';
    try {
      const configuredUserId = String(window.ValleAndroid.nativeNotificationUserId?.() || '');
      configuredForCurrentUser = !configuredUserId || configuredUserId === String(profile.id);
      permission = String(window.ValleAndroid.nativeNotificationPermission?.() || 'prompt');
      active = configuredForCurrentUser && !!window.ValleAndroid.areNativeNotificationsEnabled();
    } catch (_) {}

    updateButtons(active);

    if (active) {
      setStatus('Notificações nativas ativadas neste Android. O VALLE continuará verificando vencimentos em segundo plano.', 'success');
    } else if (!configuredForCurrentUser) {
      setStatus('As notificações deste aparelho estavam vinculadas a outro usuário. Ative para este usuário de serviço.', 'warning');
    } else if (permission !== 'granted') {
      setStatus('Ative e permita as notificações quando o Android solicitar.', 'secondary');
    } else {
      setStatus('Ative para receber avisos de vales vencendo hoje e da validade da sessão mesmo com o aplicativo fechado.', 'secondary');
    }
  }

  async function refreshWeb() {
    const activateBtn = $('activatePushNotifications');
    const testBtn = $('testPushNotifications');
    if (!activateBtn) return;

    if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      activateBtn.disabled = true;
      if (testBtn) {
        testBtn.disabled = true;
        testBtn.setAttribute('aria-disabled', 'true');
        testBtn.classList.add('is-disabled');
      }
      setStatus('Este aparelho ou navegador não oferece notificações push. No iPhone, instale o VALLE pela opção “Adicionar à Tela de Início”.', 'warning');
      return;
    }

    const profile = window.ValleCloud?.profile;
    if (profile?.role && profile.role !== 'service') {
      activateBtn.classList.add('d-none');
      if (testBtn) {
        testBtn.disabled = true;
        testBtn.setAttribute('aria-disabled', 'true');
        testBtn.classList.add('is-disabled');
      }
      setStatus('O usuário de sessão não recebe notificações dos vales. Os avisos são enviados somente aos usuários de serviço desta sessão.', 'secondary');
      return;
    }

    const registration = await getRegistration().catch(() => null);
    const subscription = registration ? await registration.pushManager.getSubscription() : null;
    const active = Notification.permission === 'granted' && !!subscription;
    updateButtons(active);

    if (active) setStatus('Notificações ativadas neste aparelho.', 'success');
    else if (Notification.permission === 'denied') setStatus('As notificações estão bloqueadas nas configurações do navegador.', 'danger');
    else setStatus('Ative para receber avisos de vales vencidos mesmo com o aplicativo fechado.', 'secondary');
  }

  async function refresh() {
    const activateBtn = $('activatePushNotifications');
    if (!activateBtn) return;

    if (!supported()) {
      activateBtn.disabled = true;
      const testBtn = $('testPushNotifications');
      if (testBtn) {
        testBtn.disabled = true;
        testBtn.setAttribute('aria-disabled', 'true');
        testBtn.classList.add('is-disabled');
      }
      setStatus('Este aparelho não oferece notificações compatíveis.', 'warning');
      return;
    }

    if (isNativeAndroid()) await refreshNative();
    else await refreshWeb();
  }

  document.addEventListener('DOMContentLoaded', function () {
    $('activatePushNotifications')?.addEventListener('click', async function () {
      const active = this.dataset.notificationActive === 'true';
      this.disabled = true;
      try {
        if (active) await deactivate();
        else await activate();
      } finally {
        if (document.body.contains(this)) this.disabled = false;
      }
    });

    $('testPushNotifications')?.addEventListener('click', testNotification);

    const noticesModal = $('avisosCelularModal');
    noticesModal?.addEventListener('show.bs.modal', function () {
      const testBtn = $('testPushNotifications');
      if (testBtn) {
        testBtn.disabled = true;
        testBtn.setAttribute('aria-disabled', 'true');
        testBtn.classList.add('is-disabled');
      }
    });
    noticesModal?.addEventListener('shown.bs.modal', refresh);
    setTimeout(refresh, 1200);
  });

  window.VallePush = { activate, deactivate, refresh, testNotification };
})();
