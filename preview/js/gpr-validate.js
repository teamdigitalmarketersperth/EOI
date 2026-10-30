/*
 * GP Refresh — field validators shared by the EOI form and the prospectus access page.
 * Format checks only: they never decide whether a person may access anything.
 */
(function () {
	'use strict';
	var GPR = window.GPR = window.GPR || {};

	function email(value) {
		var v = String(value || '').trim();
		return v.length <= 254 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(v) && /\.[^\s@.]{2,}$/.test(v);
	}

	/* Australian numbers: mobiles and landlines (+61 / 61 / 0 prefix), 1300 / 1800 and 13 numbers.
	   Returns the number in E.164 (+61…) or the local 13/1300/1800 form, or null if invalid. */
	function auPhone(value) {
		var v = String(value || '').replace(/\(0\)/g, '').replace(/[\s().-]/g, '');
		var m = v.match(/^(?:\+61|61|0)([23478]\d{8})$/);
		if (m) return '+61' + m[1];
		if (/^1[38]00\d{6}$/.test(v) || /^13\d{4}$/.test(v)) return v;
		return null;
	}

	/* ABN: 11 digits passing the ATO weighted-checksum (subtract 1 from the first digit, weights, mod 89).
	   Returns the 11 digits, or null if invalid. */
	var ABN_WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
	function abn(value) {
		var digits = String(value || '').replace(/\s/g, '');
		if (!/^[1-9]\d{10}$/.test(digits)) return null;
		var sum = 0;
		for (var i = 0; i < 11; i++) {
			sum += (Number(digits[i]) - (i === 0 ? 1 : 0)) * ABN_WEIGHTS[i];
		}
		return sum % 89 === 0 ? digits : null;
	}

	function formatAbn(digits) {
		return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3 $4');
	}

	/* Shared field-error display: toggles aria-invalid and the field's linked error message. */
	function setFieldError(input, message) {
		var error = document.getElementById(input.id + '-error');
		input.setAttribute('aria-invalid', message ? 'true' : 'false');
		if (error) {
			error.textContent = message || '';
			error.hidden = !message;
		}
	}

	GPR.validate = { email: email, auPhone: auPhone, abn: abn, formatAbn: formatAbn };
	GPR.setFieldError = setFieldError;
})();
