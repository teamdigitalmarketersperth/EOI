/*
 * GP Refresh — prospectus access page UI.
 * Needs gpr-config.js, gpr-validate.js, gpr-access-codes.js and gpr-prospectus-verify.js loaded first.
 */
(function () {
	'use strict';
	var GPR = window.GPR || {};
	var contact = (window.GPR_CONFIG || {}).contact || {};
	var form = document.querySelector('[data-gpr-access-form]');
	if (!form || !GPR.prospectus || !GPR.validate) return;

	var code = form.querySelector('#gpr-access-code');
	var button = form.querySelector('[type="submit"]');
	var label = button.querySelector('[data-label]');
	var idleLabel = label.textContent;
	var status = form.querySelector('[data-gpr-access-status]');
	var notice = document.querySelector('[data-gpr-access-notice]');
	var busy = false;
	var contactLine = 'email ' + contact.email + ' or call ' + contact.phone;
	var MESSAGES = {
		not_configured: 'Online downloads aren’t available yet. Please ' + contactLine + '.',
		denied: 'That code isn’t valid. Check it’s exactly as sent to you, or ' + contactLine + ' for a new code.',
		unavailable: 'We couldn’t check your code in this browser. Please try another browser, or ' + contactLine + '.'
	};

	var RULES = {
		code: function (v) {
			if (!v) return 'Enter your unique access code.';
			var length = GPR.prospectus.normalise(v).length;
			return length >= 4 && length <= 64 ? '' : 'Enter the code exactly as sent to you.';
		}
	};

	function check(input) {
		var message = RULES[input.name](input.value.trim());
		GPR.setFieldError(input, message);
		return !message;
	}

	function showStatus(message, tone) {
		status.textContent = '';
		status.hidden = !message;
		status.className = 'gpr-page-status' + (tone ? ' gpr-page-status--' + tone : '');
		if (message) status.append(message);
	}

	function setBusy(value) {
		busy = value;
		button.disabled = value;
		form.setAttribute('aria-busy', String(value));
		button.classList.toggle('is-loading', value);
		label.textContent = value ? 'Verifying…' : idleLabel;
	}

	if (!GPR.prospectus.isConfigured() && notice) {
		notice.textContent = MESSAGES.not_configured;
		notice.hidden = false;
	}

	// The GHL email/SMS links here as prospectus-access.html?code=GPR-XXXXX-XXXXX: fill the code in, then drop it
	// from the address bar so it isn't left in the visible URL
	var params = new URLSearchParams(window.location.search);
	if (params.has('code')) {
		code.value = params.get('code').trim().slice(0, 64);
		params.delete('code');
		var query = params.toString();
		history.replaceState(null, '', window.location.pathname + (query ? '?' + query : '') + window.location.hash);
	}

	[code].forEach(function (input) {
		input.addEventListener('blur', function () {
			if (input.value.trim() || input.getAttribute('aria-invalid') === 'true') check(input);
		});
		input.addEventListener('input', function () {
			if (input.getAttribute('aria-invalid') === 'true') check(input);
		});
	});

	form.addEventListener('submit', function (event) {
		event.preventDefault();
		if (busy) return;
		showStatus('');
		var invalid = [code].filter(function (input) { return !check(input); });
		if (invalid.length) {
			invalid[0].focus();
			return;
		}
		setBusy(true);
		GPR.prospectus.verify({ code: code.value.trim() }).then(function (result) {
			setBusy(false);
			if (result.status === 'not_configured' && notice && !notice.hidden) {
				notice.focus();  // the notice already says why; don't repeat it below the form
				return;
			}
			if (result.status !== 'approved') {
				showStatus(MESSAGES[result.status] || MESSAGES.unavailable, 'error');
				if (result.status === 'denied') code.focus();
				return;
			}
			var link = document.createElement('a');
			link.href = result.downloadUrl;
			link.textContent = 'download it here';
			link.rel = 'noopener';
			showStatus('Verified. Your prospectus download is starting. If it doesn’t, ', 'success');
			status.append(link, '.');
			window.location.assign(result.downloadUrl);
		});
	});

	button.disabled = false;
})();
