<script>
    (() => {
        const disclosure = document.getElementById('inspection-filter-disclosure');
        if (!disclosure) return;

        const narrowViewport = window.matchMedia('(max-width: 767px)');
        const setDefaultForViewport = () => {
            disclosure.open = !narrowViewport.matches;
        };
        setDefaultForViewport();
        narrowViewport.addEventListener('change', setDefaultForViewport);
    })();
</script>
