/*
 * SABE · Navegación del prototipo (solo demostración, sin backend)
 * Conecta las pantallas de stitch/ entre sí y simula el rol de la sesión.
 * Roles: estudiante | control | admin  (se guarda en sessionStorage)
 */
(function () {
  'use strict';

  var ROUTES = {
    login: 'sabe_inicio_de_sesi_n_institucional_uan_uae',
    recuperar: 'sabe_recuperar_contrase_a_uan_uae',
    cambio: 'sabe_cambio_obligatorio_de_contrase_a_uan_uae',
    estudiante: 'sabe_estudiantes',
    historial: 'sabe_cancelar_solicitud_pendiente_estudiante',
    detalle: 'sabe_detalle_de_folio_sabe_2026_014_estudiante',
    convocatoria: 'sabe_convocatoria_cerrada_solicitud_extempor_nea_estudiante',
    notifEst: 'sabe_panel_de_notificaciones_estudiante_y_control_escolar',
    solicitudes: 'sabe_solicitudes_control_escolar',
    oferta: 'sabe_oferta_academica_control_escolar',
    periodo: 'sabe_periodo_y_convocatoria_control_escolar',
    importar: 'sabe_importaci_n_de_csv_control_escolar',
    lotes: 'sabe_lotes_exportados_a_sadce_control_escolar',
    bitacora: 'sabe_bitacora_auditoria',
    notifCe: 'sabe_notificaciones_de_control_escolar_uae_uan',
    usuarios: 'sabe_usuarios_y_roles_administrador'
  };

  var STUDENT_PAGES = [ROUTES.estudiante, ROUTES.historial, ROUTES.detalle, ROUTES.convocatoria, ROUTES.notifEst, ROUTES.cambio];
  var HOME = { estudiante: 'estudiante', control: 'solicitudes', admin: 'usuarios' };

  function page() {
    var p = decodeURIComponent(location.pathname).split('/');
    return p[p.length - 2] || '';
  }
  function url(key, hash) {
    return '../' + ROUTES[key] + '/code.html' + (hash ? '#' + hash : '');
  }
  function go(key, hash) {
    if (ROUTES[key] === page() && !hash) return;
    location.href = url(key, hash);
  }

  function getRole() {
    var r = null;
    try { r = sessionStorage.getItem('sabe_role'); } catch (e) { /* sin storage */ }
    if (r) return r;
    var pg = page();
    if (STUDENT_PAGES.indexOf(pg) >= 0) return 'estudiante';
    if (pg === ROUTES.usuarios) return 'admin';
    return 'control';
  }
  function setRole(r) { try { sessionStorage.setItem('sabe_role', r); } catch (e) { /* sin storage */ } }

  /* ---------- toast ---------- */
  function toast(msg) {
    var t = document.getElementById('sabe-proto-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'sabe-proto-toast';
      t.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#002b49;color:#fff;padding:12px 20px;border-radius:12px;font:600 13px Inter,system-ui,sans-serif;box-shadow:0 10px 25px rgba(0,43,73,.3);z-index:99999;opacity:0;transition:opacity .2s;max-width:90vw;text-align:center';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.style.opacity = '0'; }, 2800);
  }

  /* ---------- reglas por texto ---------- */
  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }

  // [regex, destino, solo si el elemento NO tiene onclick propio]
  var RULES = [
    [/cerrar sesi[oó]n|^logout/, function () { try { sessionStorage.removeItem('sabe_role'); } catch (e) {} go('login'); }, false],
    [/ir a iniciar sesi[oó]n|volver a iniciar sesi[oó]n|volver al inicio de sesi[oó]n|cancelar y volver/, function () { go('login'); }, false],
    // estudiante
    [/resumen general|inicio \/ dashboard/, function () { go('estudiante', 'dashboard'); }, true],
    [/horario semestral|validador de horarios/, function () { go('estudiante', 'horario'); }, true],
    [/cat[aá]logo de asignaturas|solicitud de altas|solicitud de bajas|volver a solicitar|regresar al cat[aá]logo|ir al cat[aá]logo|explorar cat[aá]logo/, function () { go('estudiante', 'catalogo'); }, true],
    [/avisos y convocatoria/, function () { go('notifEst'); }, true],
    [/historial y tr[aá]mites|historial y dict[aá]menes|volver a historial|ver folios anteriores|ver historial de movimientos/, function () { go('historial'); }, true],
    [/consultar acuse|^ver detalles?$|comprobante|ver dictamen/, function () { go('detalle'); }, true],
    [/solicitar de forma extempor/, function () { go('convocatoria'); }, true],
    // control escolar
    [/solicitudes pendientes|revisar y dictaminar|ver expediente|evaluar caso|ir a dictamen/, function () { go('solicitudes'); }, true],
    [/oferta acad[eé]mica|ajustar cupo|ver lista de espera/, function () { go('oferta'); }, true],
    [/periodo y convocatoria/, function () { go('periodo'); }, true],
    [/importaci[oó]n de datos|cuentas de estudiantes|ir a padr[oó]n/, function () { go('importar'); }, true],
    [/exportar excel|exportar a sadce|exportaci[oó]n a sadce|generar archivo de exportaci/, function () { go('lotes'); }, true],
    [/bit[aá]cora|historial & auditor/, function () { go('bitacora'); }, true],
    [/usuarios y roles/, function () { go('usuarios'); }, true],
    [/ver cuentas de estudiantes generadas/, function () {
      if (getRole() === 'admin') go('usuarios'); else toast('Las cuentas generadas las consulta el administrador.');
    }, false]
  ];

  function isNavigable(el) {
    var tag = el.tagName;
    return tag === 'A' || tag === 'BUTTON';
  }

  function onClick(ev) {
    var el = ev.target.closest && ev.target.closest('a,button');
    if (!el || !isNavigable(el)) return;
    if (el.closest('[data-proto-skip]')) return;
    var pg = page();

    // campana de notificaciones
    var lab = norm((el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('title') || '') + ' ' + (el.id || ''));
    if (/notificaci|notif-button/.test(lab) && !/cerrar/.test(lab)) {
      ev.preventDefault(); ev.stopPropagation();
      if (getRole() === 'estudiante') go('notifEst'); else go('notifCe');
      return;
    }

    // el portal del estudiante maneja su propia navegación interna
    if (pg === ROUTES.estudiante) {
      var t0 = norm(el.textContent);
      if (/cerrar sesi/.test(t0 + ' ' + norm(el.getAttribute('title')))) {
        ev.preventDefault(); try { sessionStorage.removeItem('sabe_role'); } catch (e) {} go('login'); return;
      }
      if (/consultar acuse/.test(t0)) { ev.preventDefault(); go('detalle'); }
      return;
    }

    var text = norm(el.textContent) + ' ' + norm(el.getAttribute('title')) + ' ' + norm(el.getAttribute('aria-label'));
    for (var i = 0; i < RULES.length; i++) {
      var r = RULES[i];
      if (r[0].test(text)) {
        if (r[2] && el.hasAttribute('onclick')) return;
        if (el.tagName === 'BUTTON' && /^(button|submit)$/.test(el.type || '') && el.form && !r[0].test(norm(el.textContent))) return;
        // botones de formulario sin relación con la navegación se respetan
        ev.preventDefault(); ev.stopPropagation();
        r[1]();
        return;
      }
    }
  }
  document.addEventListener('click', onClick, true);

  /* ---------- menú del administrador en pantallas compartidas ---------- */
  function adaptAdmin() {
    if (getRole() !== 'admin') return;
    var pg = page();
    if (pg === ROUTES.usuarios) return;
    var aside = document.querySelector('aside');
    if (!aside) return;
    var links = aside.querySelectorAll('nav a');
    var first = null;
    links.forEach(function (a) {
      var t = norm(a.textContent);
      if (/solicitudes pendientes|oferta|importaci|cuentas|exportar/.test(t)) { a.style.display = 'none'; }
      else if (!first) first = a;
    });
    if (first && !aside.querySelector('[data-proto-usuarios]')) {
      var c = first.cloneNode(true);
      c.setAttribute('data-proto-usuarios', '1');
      c.removeAttribute('aria-current');
      c.className = first.className.replace(/bg-primary-container|text-on-primary-container|font-semibold/g, '').trim() +
        ' text-on-surface-variant';
      var spans = c.querySelectorAll('span');
      if (spans[0]) spans[0].textContent = 'admin_panel_settings';
      if (spans[1]) spans[1].textContent = 'Usuarios y Roles';
      first.parentNode.insertBefore(c, first.parentNode.firstChild);
    }
    // identidad en el encabezado
    document.querySelectorAll('header span').forEach(function (s) {
      if (s.children.length) return;
      if (/Valeria M\. Ruiz/.test(s.textContent)) s.textContent = 'Mtro. Fernando Morales G.';
      if (/Ventanilla Control Escolar/.test(s.textContent)) s.textContent = 'Administrador del sistema';
    });
  }

  /* ---------- campana y salida en encabezados de control escolar / admin ---------- */
  function injectHeaderActions() {
    if (STUDENT_PAGES.indexOf(page()) >= 0 || page() === ROUTES.login || page() === ROUTES.recuperar) return;
    var header = document.querySelector('header');
    if (!header || header.querySelector('[data-proto-actions]')) return;
    var right = header.lastElementChild;
    if (!right) return;
    var box = document.createElement('div');
    box.setAttribute('data-proto-actions', '1');
    box.style.cssText = 'display:flex;align-items:center;gap:8px;margin-right:8px';
    function mk(icon, title, extra) {
      var b = document.createElement('button');
      b.type = 'button';
      b.title = title;
      b.setAttribute('aria-label', title);
      b.style.cssText = 'width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#42474d;background:transparent;border:0;cursor:pointer';
      b.onmouseenter = function () { b.style.background = '#e5eeff'; };
      b.onmouseleave = function () { b.style.background = 'transparent'; };
      var s = document.createElement('span');
      s.className = 'material-symbols-outlined';
      s.style.fontSize = '22px';
      s.textContent = icon;
      b.appendChild(s);
      return b;
    }
    if (getRole() !== 'admin') box.appendChild(mk('notifications', 'Notificaciones'));
    box.appendChild(mk('logout', 'Cerrar sesión'));
    right.insertBefore(box, right.firstChild);
  }

  document.addEventListener('DOMContentLoaded', function () {
    adaptAdmin();
    injectHeaderActions();

    // portal del estudiante: abrir la vista indicada en el hash (#horario, #catalogo...)
    if (page() === ROUTES.estudiante && location.hash) {
      var v = location.hash.slice(1);
      if (typeof window.switchView === 'function' && /^(dashboard|horario|catalogo|confirmacion|historial)$/.test(v)) {
        window.switchView(v);
      }
    }
  });

  /* ---------- login por rol (demostración) ---------- */
  function loginSuccess(user, pass) {
    var u = (user || '').trim().toLowerCase();
    var role = /^\d{8,9}$/.test(u) ? 'estudiante' : (/admin/.test(u) ? 'admin' : 'control');
    setRole(role);
    if (role === 'estudiante' && (pass || '').toLowerCase() === 'temporal') go('cambio');
    else go(HOME[role]);
  }

  window.handleFormSubmit = function () {
    var id = document.getElementById('student-id');
    var pw = document.getElementById('password');
    var alertBox = document.getElementById('feedback-alert');
    var msg = document.getElementById('feedback-message');
    if (!id || !pw) return;
    if (!id.value.trim() || !pw.value.trim()) {
      if (msg) msg.textContent = 'Por favor ingresa tanto tu usuario como tu contraseña.';
      if (alertBox) { alertBox.classList.remove('hidden'); alertBox.classList.add('flex'); }
      return;
    }
    if (alertBox) { alertBox.classList.add('hidden'); alertBox.classList.remove('flex'); }
    loginSuccess(id.value, pw.value);
  };

  window.simulateBackToLogin = function (ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    go('login');
  };

  window.SABE = { go: go, toast: toast, role: getRole, setRole: setRole, loginSuccess: loginSuccess, routes: ROUTES };
})();
