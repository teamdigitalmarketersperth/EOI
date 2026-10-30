/*
 * GP Refresh — Expression of Interest form (landing page, section 3).
 * Needs gpr-config.js and gpr-validate.js loaded first.
 *
 * Submission paths, chosen by GPR_CONFIG.eoi:
 *   ghlFormEmbedUrl  the GHL-hosted form replaces this form; GHL shows its own on-submit message.
 *   submitUrl        this form POSTs JSON there and, only after a readable 2xx response, hides the form
 *                    and shows the thank-you message in its place (same tab, no page change).
 *   neither          nothing is sent; the visitor is told submissions aren't connected yet.
 */
(function () {
	'use strict';
	var GPR = window.GPR || {};
	var settings = window.GPR_CONFIG || {};
	var config = settings.eoi || {};
	var contact = settings.contact || {};
	var validate = GPR.validate;
	if (!validate) return;

	var GHL_EMBED_SCRIPT = 'https://link.msgsndr.com/js/form_embed.js';
	var TIMEOUT_MS = 20000;
	var RULES = {
		firstName: function (v) { return v ? '' : 'Enter your first name.'; },
		lastName: function (v) { return v ? '' : 'Enter your last name.'; },
		email: function (v) {
			if (!v) return 'Enter your email address.';
			return validate.email(v) ? '' : 'Enter a valid email address, for example name@example.com.';
		},
		phone: function (v) {
			if (!v) return 'Enter your phone number.';
			return validate.auPhone(v) ? '' : 'Enter a valid Australian phone number, for example 0412 345 678 or 02 9876 5432.';
		},
		abn: function (v) {
			if (!v) return 'Enter your ABN.';
			if (!/^\d{11}$/.test(v.replace(/\s/g, ''))) return 'An ABN has 11 digits.';
			return validate.abn(v) ? '' : 'This ABN isn’t valid. Check the number and try again.';
		},
		companyName: function (v) { return v ? '' : 'Enter your company name.'; }
	};

	function contactLine() {
		return 'Please email ' + contact.email + ' or call ' + contact.phone + '.';
	}

	function embedGhlForm(root, form) {
		var holder = root.querySelector('[data-gpr-eoi-embed]');
		var url = config.ghlFormEmbedUrl;
		var formId = url.split(/[/?#]/).filter(Boolean).pop();
		var iframe = document.createElement('iframe');
		iframe.src = url;
		iframe.id = 'inline-' + formId;
		iframe.title = 'Expression of Interest form';
		iframe.setAttribute('data-layout', "{'id':'INLINE'}");
		iframe.setAttribute('data-trigger-type', 'alwaysShow');
		iframe.setAttribute('data-form-id', formId);
		iframe.className = 'gpr-ow-eoi__iframe';
		holder.appendChild(iframe);
		holder.hidden = false;
		form.hidden = true;
		if (!document.querySelector('script[src="' + GHL_EMBED_SCRIPT + '"]')) {
			var script = document.createElement('script');
			script.src = GHL_EMBED_SCRIPT;
			script.async = true;
			document.body.appendChild(script);
		}
	}

	function send(payload) {
		if (!config.submitUrl) return Promise.reject(new Error('not_configured'));
		var controller = window.AbortController ? new AbortController() : null;
		var timer = controller && setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
		return fetch(config.submitUrl, {
			method: 'POST',
			mode: 'cors',
			credentials: 'omit',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify(payload),
			signal: controller ? controller.signal : undefined
		}).then(function (response) {
			clearTimeout(timer);
			// A CORS-blocked or non-2xx response is a failure: never assume GHL received it.
			if (!response.ok) throw new Error('HTTP ' + response.status);
		}, function (error) {
			clearTimeout(timer);
			throw error;
		});
	}

	document.querySelectorAll('[data-gpr-eoi]').forEach(function (root) {
		if (root.dataset.initialized) return;
		root.dataset.initialized = 'true';
		var form = root.querySelector('[data-gpr-eoi-form]');
		if (!form) return;
		if (/^https:\/\//.test(config.ghlFormEmbedUrl || '')) {
			embedGhlForm(root, form);
			return;
		}

		var button = form.querySelector('[type="submit"]');
		var label = button.querySelector('[data-label]');
		var idleLabel = label.textContent;
		var status = form.querySelector('[data-gpr-eoi-status]');
		var inputs = Array.prototype.slice.call(form.querySelectorAll('input[name]'));
		var busy = false;

		function check(input) {
			var message = RULES[input.name](input.value.trim());
			GPR.setFieldError(input, message);
			return !message;
		}

		function showStatus(message) {
			status.textContent = message;
			status.hidden = !message;
		}

		function setBusy(value) {
			busy = value;
			button.disabled = value;
			form.setAttribute('aria-busy', String(value));
			button.classList.toggle('is-loading', value);
			label.textContent = value ? 'Submitting…' : idleLabel;
		}

		inputs.forEach(function (input) {
			input.addEventListener('blur', function () {
				if (input.name === 'abn' && validate.abn(input.value)) input.value = validate.formatAbn(validate.abn(input.value));
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
			var invalid = inputs.filter(function (input) { return !check(input); });
			if (invalid.length) {
				invalid[0].focus();
				return;
			}
			if (!config.submitUrl) {
				if (window.console) console.warn('GP Refresh EOI: set GPR_CONFIG.eoi.submitUrl or ghlFormEmbedUrl in js/gpr-config.js.');
				showStatus('Online submissions aren’t connected yet, so your details have not been sent. ' + contactLine());
				return;
			}
			var values = {};
			inputs.forEach(function (input) { values[input.name] = input.value.trim(); });
			setBusy(true);
			send({
				first_name: values.firstName,
				last_name: values.lastName,
				email: values.email,
				phone: validate.auPhone(values.phone),
				abn: validate.abn(values.abn),
				company_name: values.companyName,
				source: 'GP Refresh Our World — Expression of Interest',
				page_url: window.location.href,
				submitted_at: new Date().toISOString()
			}).then(function () {
				// Confirmed: replace the form with the thank-you message in the same card.
				var thanks = root.querySelector('[data-gpr-eoi-thanks]');
				form.reset();
				form.hidden = true;
				thanks.hidden = false;
				var heading = thanks.querySelector('[tabindex="-1"]');
				heading.focus({ preventScroll: true });
				root.scrollIntoView({ block: 'start' });
			}, function () {
				setBusy(false);
				showStatus('We couldn’t submit your Expression of Interest. Check your connection and try again. '
					+ 'If this keeps happening, ' + contactLine().charAt(0).toLowerCase() + contactLine().slice(1));
			});
		});

		button.disabled = false;
	});
})();
