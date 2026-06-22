(function () {
    function build(native) {
        if (native.dataset.cs === '1') return;
        native.dataset.cs = '1';

        const wrapper = document.createElement('div');
        wrapper.className = 'cs-wrapper';

        const trigger = document.createElement('div');
        trigger.className = 'cs-trigger';
        trigger.setAttribute('tabindex', '0');
        trigger.setAttribute('role', 'combobox');
        trigger.setAttribute('aria-expanded', 'false');

        const valueSpan = document.createElement('span');
        valueSpan.className = 'cs-value';

        const arrow = document.createElement('i');
        arrow.className = 'bi bi-chevron-down cs-arrow';

        trigger.appendChild(valueSpan);
        trigger.appendChild(arrow);

        const dropdown = document.createElement('div');
        dropdown.className = 'cs-dropdown';
        dropdown.setAttribute('role', 'listbox');

        const optsList = document.createElement('div');
        optsList.className = 'cs-options';
        dropdown.appendChild(optsList);

        wrapper.appendChild(trigger);
        wrapper.appendChild(dropdown);

        native.parentNode.insertBefore(wrapper, native);
        native.style.cssText = 'position:absolute;opacity:0;pointer-events:none;width:1px;height:1px;';
        wrapper.appendChild(native);

        function syncOptions() {
            optsList.innerHTML = '';
            Array.from(native.options).forEach(function (opt, i) {
                var item = document.createElement('div');
                item.className = 'cs-option';
                item.setAttribute('role', 'option');
                item.dataset.value = opt.value;
                item.textContent = opt.text;
                if (!opt.value) item.classList.add('cs-ph');
                if (native.selectedIndex === i) {
                    item.classList.add('cs-sel');
                    item.setAttribute('aria-selected', 'true');
                }
                item.addEventListener('mousedown', function (e) {
                    e.preventDefault();
                    choose(i);
                    close();
                });
                optsList.appendChild(item);
            });
            updateFace();
        }

        function updateFace() {
            var sel = native.options[native.selectedIndex];
            if (!sel) return;
            valueSpan.textContent = sel.text;
            valueSpan.classList.toggle('cs-ph-text', !sel.value);
        }

        function choose(idx) {
            native.selectedIndex = idx;
            Array.from(optsList.children).forEach(function (el, i) {
                el.classList.toggle('cs-sel', i === idx);
                el.setAttribute('aria-selected', i === idx ? 'true' : 'false');
            });
            updateFace();
            native.dispatchEvent(new Event('change', { bubbles: true }));
        }

        function open() {
            document.querySelectorAll('.cs-wrapper.cs-open').forEach(function (w) {
                if (w !== wrapper) {
                    w.classList.remove('cs-open');
                    var t = w.querySelector('.cs-trigger');
                    if (t) t.setAttribute('aria-expanded', 'false');
                    var a = w.querySelector('.cs-arrow');
                    if (a) a.style.transform = '';
                }
            });
            syncOptions();
            wrapper.classList.add('cs-open');
            trigger.setAttribute('aria-expanded', 'true');
            arrow.style.transform = 'rotate(180deg)';
            var sel = optsList.querySelector('.cs-sel');
            if (sel) requestAnimationFrame(function () { sel.scrollIntoView({ block: 'nearest' }); });
        }

        function close() {
            wrapper.classList.remove('cs-open');
            trigger.setAttribute('aria-expanded', 'false');
            arrow.style.transform = '';
        }

        trigger.addEventListener('click', function () {
            wrapper.classList.contains('cs-open') ? close() : open();
        });

        trigger.addEventListener('keydown', function (e) {
            var len = native.options.length;
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                wrapper.classList.contains('cs-open') ? close() : open();
            } else if (e.key === 'Escape') {
                close();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                choose(Math.min(native.selectedIndex + 1, len - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                choose(Math.max(native.selectedIndex - 1, 0));
            }
        });

        // Watch for dynamic option changes (Supabase loads, serie refresh, etc.)
        new MutationObserver(function () {
            syncOptions();
        }).observe(native, { childList: true, subtree: true });

        syncOptions();
    }

    // Close when clicking outside any custom select
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.cs-wrapper')) {
            document.querySelectorAll('.cs-wrapper.cs-open').forEach(function (w) {
                w.classList.remove('cs-open');
                var t = w.querySelector('.cs-trigger');
                if (t) t.setAttribute('aria-expanded', 'false');
                var a = w.querySelector('.cs-arrow');
                if (a) a.style.transform = '';
            });
        }
    });

    function init() {
        document.querySelectorAll('select:not([data-cs])').forEach(build);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.initCustomSelects = init;
})();
