;(() => {
  const alreadyInstalled = Boolean(window.__demo)
  const Z = 2_147_483_647
  const CURSOR_KEY = '__demoCursor'
  const stored = (() => {
    try {
      return JSON.parse(sessionStorage.getItem(CURSOR_KEY)) ?? {}
    } catch {
      return {}
    }
  })()
  const state = { x: 100, y: 100, ...stored }
  let glyph = 'arrow'

  const SHADOW =
    '<feFlood flood-opacity="0" result="bg"/><feColorMatrix in="SourceAlpha" result="hardAlpha" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"/>' +
    '<feOffset dy="2"/><feGaussianBlur stdDeviation="1.5"/><feComposite in2="hardAlpha" operator="out"/>' +
    '<feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.2 0"/><feBlend in2="bg" result="shadow"/><feBlend in="SourceGraphic" in2="shadow"/>'

  // Hotspots in 44-unit viewBox coordinates.
  const GLYPHS = {
    arrow: {
      hot: [15.5, 11],
      filter: 'width="20.037" height="29.703" x="11.5" y="9.063"',
      body:
        '<path fill="#000" d="M16.183 11.397a.25.25 0 0 0-.433.17V27.41a.75.75 0 0 0 1.228.579l2.676-2.212a.25.25 0 0 1 .39.094l2.46 5.754a1.467 1.467 0 0 0 2.706-1.134l-2.349-5.718a.25.25 0 0 1 .232-.344h3.44a.75.75 0 0 0 .55-1.26z"/>' +
        '<path stroke="#fff" stroke-linejoin="round" stroke-width="1.25" d="M15.125 11.566c0-.746.858-1.129 1.411-.692l.106.098 10.9 11.772c.815.88.19 2.31-1.009 2.31h-2.88l2.135 5.2a2.092 2.092 0 0 1-3.858 1.617l-2.265-5.293-2.289 1.893c-.896.74-2.25.103-2.251-1.06z"/>',
    },
    hand: {
      hot: [19.8, 11.2],
      filter: 'x="9.75" y="10.1726" width="24.1748" height="29.4524"',
      body:
        '<path fill-rule="evenodd" clip-rule="evenodd" fill="#000" d="M23.1263 33.3026C24.4488 33.3026 25.5988 33.0276 26.5738 32.4764C27.5513 31.9251 28.3063 31.1189 28.8375 30.0539C29.37 28.9889 29.6363 27.6864 29.6363 26.1426V24.0801C29.6363 23.1214 29.4863 22.3851 29.1863 21.8676C28.8863 21.3514 28.4538 21.0926 27.8925 21.0926V22.4601C27.8925 22.6501 27.8287 22.8026 27.7037 22.9164C27.5775 23.0301 27.4363 23.0864 27.2763 23.0864C27.1088 23.0864 26.9625 23.0301 26.8375 22.9164C26.7113 22.8026 26.6487 22.6501 26.6487 22.4601V20.7614C26.6487 20.4201 26.5612 20.1551 26.3875 19.9689C26.2112 19.7826 25.965 19.6901 25.645 19.6901C25.395 19.6901 25.1475 19.7439 24.905 19.8501V22.0164C24.905 22.2139 24.8412 22.3689 24.7162 22.4839C24.59 22.5976 24.4488 22.6539 24.2888 22.6539C24.1213 22.6539 23.975 22.5976 23.85 22.4839C23.7237 22.3689 23.6613 22.2139 23.6613 22.0164V19.5076C23.6613 19.1739 23.5725 18.9089 23.3937 18.7151C23.215 18.5214 22.9738 18.4239 22.67 18.4239C22.4113 18.4239 22.16 18.4814 21.9175 18.5951V21.5826C21.9175 21.7576 21.8587 21.9064 21.74 22.0276C21.6225 22.1489 21.4725 22.2101 21.29 22.2101C21.115 22.2101 20.9688 22.1489 20.8513 22.0276C20.7338 21.9064 20.6738 21.7576 20.6738 21.5826V13.3514C20.6738 13.0701 20.5963 12.8439 20.44 12.6726C20.285 12.5014 20.0737 12.4164 19.8075 12.4164C19.5412 12.4164 19.3275 12.5014 19.1638 12.6726C19 12.8439 18.9188 13.0701 18.9188 13.3514V24.9464C18.9188 25.1901 18.8463 25.3889 18.7025 25.5451C18.5575 25.7001 18.375 25.7776 18.155 25.7776C17.9563 25.7776 17.78 25.7289 17.625 25.6301C17.4687 25.5314 17.3375 25.3489 17.2313 25.0826L15.7037 21.5939C15.5137 21.1376 15.2275 20.9101 14.8487 20.9101C14.605 20.9101 14.4075 20.9876 14.255 21.1439C14.1025 21.2989 14.0275 21.4876 14.0275 21.7076C14.0275 21.8901 14.0613 22.0726 14.13 22.2551L16.1713 28.0014C16.8388 29.8639 17.7675 31.2114 18.9525 32.0489C20.1387 32.8851 21.53 33.3026 23.1263 33.3026ZM23.0812 34.6251C21.1337 34.6251 19.4787 34.1039 18.115 33.0639C16.75 32.0226 15.7075 30.4751 14.985 28.4226L12.9437 22.6651C12.8825 22.4839 12.8363 22.2939 12.8013 22.0951C12.7675 21.8976 12.75 21.7189 12.75 21.5601C12.75 20.9664 12.9475 20.5076 13.3438 20.1801C13.7375 19.8539 14.2025 19.6901 14.7337 19.6901C15.1225 19.6901 15.4713 19.8026 15.7838 20.0264C16.095 20.2501 16.345 20.5876 16.5363 21.0351L17.4362 23.2589C17.4587 23.3114 17.4938 23.3376 17.5388 23.3376C17.6 23.3376 17.63 23.3039 17.63 23.2364V13.4301C17.63 12.7389 17.835 12.1901 18.2463 11.7826C18.6563 11.3764 19.1762 11.1726 19.8075 11.1726C20.4312 11.1726 20.9462 11.3764 21.3525 11.7826C21.7587 12.1901 21.9625 12.7389 21.9625 13.4301V17.3189C22.2588 17.2351 22.5475 17.1926 22.83 17.1926C23.3162 17.1926 23.73 17.3201 24.0725 17.5751C24.4138 17.8301 24.6537 18.1776 24.7912 18.6189C25.14 18.4976 25.4825 18.4364 25.8175 18.4364C26.2875 18.4364 26.685 18.5551 27.0075 18.7951C27.3313 19.0339 27.5538 19.3589 27.675 19.7701C28.7075 19.7776 29.5088 20.1426 30.075 20.8639C30.6413 21.5864 30.925 22.6014 30.925 23.9076V26.2914C30.925 28.0539 30.5938 29.5576 29.9325 30.8001C29.2713 32.0439 28.3512 32.9901 27.1737 33.6451C25.995 34.2989 24.6312 34.6251 23.0812 34.6251Z"/>' +
        '<path fill-rule="evenodd" clip-rule="evenodd" fill="#fff" d="M23.1261 33.3025C24.4486 33.3025 25.5986 33.0275 26.5736 32.4763C27.5511 31.925 28.3061 31.1188 28.8373 30.0538C29.3698 28.9888 29.6361 27.6863 29.6361 26.1425V24.08C29.6361 23.1213 29.4861 22.385 29.1861 21.8675C28.8861 21.3513 28.4536 21.0925 27.8923 21.0925V22.46C27.8923 22.65 27.8286 22.8025 27.7036 22.9163C27.5773 23.03 27.4361 23.0863 27.2761 23.0863C27.1086 23.0863 26.9623 23.03 26.8373 22.9163C26.7111 22.8025 26.6486 22.65 26.6486 22.46V20.7613C26.6486 20.42 26.5611 20.155 26.3873 19.9688C26.2111 19.7825 25.9648 19.69 25.6448 19.69C25.3948 19.69 25.1473 19.7438 24.9048 19.85V22.0163C24.9048 22.2138 24.8411 22.3688 24.7161 22.4838C24.5898 22.5975 24.4486 22.6538 24.2886 22.6538C24.1211 22.6538 23.9748 22.5975 23.8498 22.4838C23.7236 22.3688 23.6611 22.2138 23.6611 22.0163V19.5075C23.6611 19.1738 23.5723 18.9088 23.3936 18.715C23.2148 18.5213 22.9736 18.4238 22.6698 18.4238C22.4111 18.4238 22.1598 18.4813 21.9173 18.595V21.5825C21.9173 21.7575 21.8586 21.9063 21.7398 22.0275C21.6223 22.1488 21.4723 22.21 21.2898 22.21C21.1148 22.21 20.9686 22.1488 20.8511 22.0275C20.7336 21.9063 20.6736 21.7575 20.6736 21.5825V13.3513C20.6736 13.07 20.5961 12.8438 20.4398 12.6725C20.2848 12.5013 20.0736 12.4163 19.8073 12.4163C19.5411 12.4163 19.3273 12.5013 19.1636 12.6725C18.9998 12.8438 18.9186 13.07 18.9186 13.3513V24.9463C18.9186 25.19 18.8461 25.3888 18.7023 25.545C18.5573 25.7 18.3748 25.7775 18.1548 25.7775C17.9561 25.7775 17.7798 25.7288 17.6248 25.63C17.4686 25.5313 17.3373 25.3488 17.2311 25.0825L15.7036 21.5938C15.5136 21.1375 15.2273 20.91 14.8486 20.91C14.6048 20.91 14.4073 20.9875 14.2548 21.1438C14.1023 21.2988 14.0273 21.4875 14.0273 21.7075C14.0273 21.89 14.0611 22.0725 14.1298 22.255L16.1711 28.0013C16.8386 29.8638 17.7673 31.2113 18.9523 32.0488C20.1386 32.885 21.5298 33.3025 23.1261 33.3025Z"/>',
    },
    ibeam: {
      hot: [22, 22],
      filter: 'x="14.2617" y="9.06836" width="15.4766" height="29.863"',
      body:
        '<path fill-rule="evenodd" clip-rule="evenodd" fill="#000" d="M21.4965 14.1401C21.3774 13.7847 20.8496 13.0522 20.5912 12.8508C20.3345 12.6522 20.0305 12.5019 19.6918 12.3946C19.6057 12.367 19.4543 12.3444 19.2648 12.3315C19.0596 12.3176 18.8369 12.3158 18.6345 12.3213C18.5698 12.3233 18.5698 12.3233 18.5583 12.3238L18.5121 11.3249C18.5322 11.324 18.5322 11.324 18.6076 11.3216C18.8389 11.3154 19.091 11.3174 19.3327 11.3339C19.5959 11.3518 19.8173 11.3848 19.9952 11.4417C20.4382 11.5821 20.8465 11.784 21.2045 12.061C21.4343 12.2401 21.7346 12.5938 21.9863 12.971C22.2454 12.5952 22.5573 12.2466 22.8182 12.0667C23.2451 11.7704 23.6335 11.5599 24.0047 11.4423C24.1839 11.3849 24.4055 11.3518 24.669 11.3339C24.9104 11.3175 25.162 11.3155 25.393 11.3217C25.4683 11.3241 25.4683 11.3241 25.4885 11.325L25.4423 12.3239C25.4307 12.3234 25.4307 12.3234 25.366 12.3214C25.1639 12.3159 24.9416 12.3177 24.7368 12.3316C24.5472 12.3445 24.3959 12.3671 24.3084 12.3951C24.0465 12.4781 23.7402 12.644 23.3871 12.8892C23.1091 13.0807 22.6289 13.7327 22.4825 14.1273L22.4821 29.8736C22.6284 30.2679 23.1085 30.9187 23.3889 31.1112C23.7397 31.3557 24.045 31.5209 24.3107 31.6036C24.3963 31.6312 24.5474 31.654 24.7368 31.667C24.9418 31.6811 25.1643 31.6829 25.3664 31.6775C25.4305 31.6755 25.4305 31.6755 25.4419 31.6749L25.4881 32.6739C25.4681 32.6748 25.4681 32.6748 25.3934 32.6771C25.1622 32.6833 24.9101 32.6813 24.6683 32.6647C24.4045 32.6465 24.1828 32.6132 24.0085 32.5568C23.6342 32.4404 23.2447 32.2297 22.82 31.9336C22.5578 31.7536 22.2449 31.4046 21.9853 31.0284C21.7339 31.4047 21.434 31.7579 21.2035 31.9384C20.8461 32.216 20.4366 32.4184 19.9972 32.5564C19.8177 32.6142 19.5961 32.6476 19.3327 32.6657C19.0905 32.6824 18.838 32.6845 18.6065 32.6782C18.5317 32.6759 18.5317 32.6759 18.5117 32.675L18.5579 31.676C18.5693 31.6766 18.5693 31.6766 18.6334 31.6786C18.8358 31.684 19.0587 31.6822 19.2641 31.6681C19.4534 31.655 19.6045 31.6323 19.694 31.6035C20.0299 31.498 20.3336 31.3479 20.5886 31.1498C20.8499 30.9452 21.3771 30.2138 21.4818 29.8546L21.4965 14.1401Z"/>' +
        '<path stroke="#fff" stroke-width="1.25" stroke-linejoin="round" d="M25.4102 10.6973H25.4121C25.4856 10.6996 25.4914 10.699 25.5166 10.7002C25.6822 10.7078 25.8385 10.7818 25.9502 10.9043C26.0617 11.0267 26.1199 11.1881 26.1123 11.3535L26.0664 12.3525C26.0587 12.5182 25.9859 12.6744 25.8633 12.7861C25.7407 12.8978 25.5787 12.956 25.4131 12.9482C25.4096 12.9481 25.4092 12.9484 25.4033 12.9482C25.3948 12.948 25.3794 12.9473 25.3467 12.9463V12.9453C25.1595 12.9403 24.9587 12.9429 24.7793 12.9551C24.6971 12.9607 24.6287 12.9678 24.5762 12.9756C24.5217 12.9837 24.4989 12.9903 24.499 12.9902L24.4971 12.9912C24.3206 13.0472 24.0729 13.1734 23.7432 13.4023L23.7422 13.4033C23.6941 13.4365 23.5552 13.5759 23.3896 13.8018C23.2651 13.9718 23.1658 14.1365 23.1074 14.2568V29.7451C23.1658 29.865 23.2644 30.0291 23.3887 30.1982C23.5125 30.3668 23.6218 30.4868 23.6895 30.5508L23.7432 30.5957L23.7461 30.5986C23.9908 30.7692 24.1902 30.8819 24.3496 30.9512L24.4961 31.0068L24.5029 31.0088C24.5065 31.0097 24.5292 31.0153 24.5771 31.0225C24.6294 31.0303 24.6974 31.0383 24.7793 31.0439C24.9586 31.0563 25.1597 31.0577 25.3467 31.0527C25.3793 31.0517 25.3948 31.0511 25.4033 31.0508H25.4121L25.5352 31.0566C25.6564 31.0749 25.7703 31.1292 25.8623 31.2129C25.9849 31.3246 26.0587 31.4808 26.0664 31.6465L26.1123 32.6445C26.12 32.81 26.0617 32.9723 25.9502 33.0947C25.8385 33.2172 25.6822 33.2903 25.5166 33.2979C25.4912 33.299 25.4862 33.2995 25.4131 33.3018H25.4102C25.1643 33.3084 24.8913 33.3064 24.625 33.2881C24.3407 33.2685 24.061 33.2304 23.8164 33.1514V33.1504C23.3618 33.0079 22.9162 32.762 22.4658 32.4482C22.3082 32.3399 22.1486 32.196 21.9951 32.0342C21.858 32.1882 21.7212 32.3271 21.5889 32.4307L21.5869 32.4316C21.1637 32.7604 20.6863 32.9934 20.1875 33.1504L20.1885 33.1514C19.9396 33.2315 19.6609 33.2694 19.376 33.2891C19.1094 33.3074 18.836 33.3094 18.5898 33.3027H18.5869C18.5138 33.3004 18.5087 33.3 18.4834 33.2988C18.3178 33.2913 18.1616 33.2182 18.0498 33.0957C17.9383 32.9733 17.8801 32.8119 17.8877 32.6465L17.9336 31.6475L17.9512 31.5254C17.9807 31.4064 18.0448 31.2976 18.1367 31.2139C18.2592 31.1023 18.4214 31.0441 18.5869 31.0518C18.5903 31.0519 18.5908 31.0516 18.5967 31.0518C18.6052 31.052 18.6207 31.0527 18.6533 31.0537H18.6523C18.8397 31.0587 19.041 31.0573 19.2207 31.0449C19.3028 31.0393 19.3714 31.0313 19.4238 31.0234C19.4746 31.0158 19.4983 31.0098 19.502 31.0088L19.5068 31.0068C19.7839 30.9198 20.0172 30.8013 20.2031 30.6572C20.2566 30.6153 20.4099 30.4467 20.582 30.2012C20.7189 30.0059 20.8124 29.8396 20.8564 29.7422L20.8701 14.2607C20.8186 14.155 20.7198 13.9877 20.5859 13.7988C20.4102 13.551 20.2584 13.3838 20.207 13.3438V13.3428C20.019 13.1977 19.7839 13.0793 19.5029 12.9902H19.501C19.4971 12.9893 19.4743 12.9828 19.4258 12.9756C19.3733 12.9678 19.3048 12.9607 19.2227 12.9551C19.0428 12.9428 18.841 12.9403 18.6533 12.9453C18.6212 12.9463 18.6062 12.947 18.5977 12.9473C18.5915 12.9475 18.5912 12.9481 18.5879 12.9482C18.4223 12.956 18.2603 12.8977 18.1377 12.7861C18.0151 12.6744 17.9413 12.5182 17.9336 12.3525L17.8877 11.3535C17.8801 11.188 17.9391 11.0258 18.0508 10.9033C18.1625 10.7811 18.318 10.7078 18.4834 10.7002C18.509 10.699 18.5141 10.6996 18.5879 10.6973H18.5908C18.8367 10.6906 19.109 10.6919 19.375 10.71C19.6585 10.7293 19.9359 10.7681 20.1826 10.8467L20.1836 10.8457C20.6857 11.0048 21.1625 11.238 21.5869 11.5664L21.5889 11.5684C21.7214 11.6717 21.8587 11.8105 21.9961 11.9648C22.1059 11.8489 22.218 11.7413 22.3311 11.6504L22.4639 11.5518C22.918 11.2367 23.3634 10.99 23.8154 10.8467V10.8477C24.0639 10.7682 24.3423 10.7293 24.627 10.71C24.8925 10.6919 25.1647 10.6906 25.4102 10.6973Z"/>',
    },
  }

  // Bitmaps: a rasterized vector at this size anti-aliases soft next to hinted UI text; the SVG is the fallback.
  function markupFor(name) {
    const png = window.__demoGlyphs?.[name]
    if (png) {
      // Not srcset: Chrome takes the denser data URL even at a 1x ratio.
      const src = window.devicePixelRatio > 1 ? png.x2 : png.x1
      return `<img src="${src}" alt="" draggable="false" style="display:block;width:${theme.cursorSize}px;height:${theme.cursorSize}px">`
    }
    const g = GLYPHS[name]
    return (
      `<svg viewBox="0 0 44 44" width="${theme.cursorSize}" height="${theme.cursorSize}" fill="none">` +
      `<g filter="url(#__demo_shadow_${name})">${g.body}</g>` +
      `<defs><filter id="__demo_shadow_${name}" ${g.filter} color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">${SHADOW}</filter></defs></svg>`
    )
  }

  const TEXT_INPUT =
    'textarea,[contenteditable]:not([contenteditable="false"]),input:not([type]),' +
    'input[type="text"],input[type="search"],input[type="email"],input[type="password"],input[type="url"],input[type="tel"],input[type="number"]'

  // `auto` is what a text field computes to.
  function glyphAt(x, y) {
    const el = document.elementFromPoint(x, y)
    if (!el) {
      return 'arrow'
    }
    const cursor = getComputedStyle(el).cursor
    if (cursor === 'pointer') {
      return 'hand'
    }
    if (cursor === 'text' || cursor === 'vertical-text' || (cursor === 'auto' && el.matches(TEXT_INPUT))) {
      return 'ibeam'
    }
    return 'arrow'
  }

  // Whether the surface painted at a point is dark: the first element under it with a mostly opaque
  // background colour decides. The overlay takes no pointer events, so hit-testing sees through it.
  // The canvas takes body's colour even where body has no box, so body and the root close the list.
  // A gradient or image has no colour to read, and nothing found means a default canvas, so light.
  function darkAt(x, y) {
    const stack = [...document.elementsFromPoint(x, y), document.body, document.documentElement]
    for (const el of stack.filter(Boolean)) {
      const [r, g, b, a] = srgb(getComputedStyle(el).backgroundColor)
      if (a > 127) {
        return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128
      }
    }
    return false
  }

  // A computed colour as sRGB bytes. Chrome serializes a colour in the syntax it was written in, so
  // an oklch(), lab() or color(display-p3 …) value comes back as itself rather than as rgb(). A canvas
  // converts any of them. A value the canvas rejects leaves the fill transparent, which reads as no colour.
  let swatch = null
  function srgb(color) {
    swatch ??= Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', {
      willReadFrequently: true,
    })
    swatch.clearRect(0, 0, 1, 1)
    swatch.fillStyle = 'transparent'
    swatch.fillStyle = color
    swatch.fillRect(0, 0, 1, 1)
    return swatch.getImageData(0, 0, 1, 1).data
  }

  // Fractional offsets on a composited layer are resampled and go soft.
  function snap(v) {
    const dpr = window.devicePixelRatio || 1
    return Math.round(v * dpr) / dpr
  }

  function hotspot() {
    const k = theme.cursorSize / 44
    const [hx, hy] = GLYPHS[glyph].hot
    return [hx * k, hy * k]
  }

  const theme = {
    cursorSize: 44,
    accent: '#be3200',
    scrim: 'rgba(10,10,10,.55)',
    captionBg: 'rgba(10,10,10,.88)',
    captionFg: '#fff',
    fontSize: 15,
    font: 'system-ui,-apple-system,"Segoe UI",sans-serif',
    ring: '',
    callout: 'tag',
    calloutBg: '#fff',
    calloutFg: '#0a0a0a',
    calloutBorder: 'rgba(10,10,10,.14)',
    ...window.__demoTheme,
  }

  const tint = (percent) => `color-mix(in srgb, ${theme.accent} ${percent}%, transparent)`

  // The framing `zoom` last set on this document's body; a new document starts at 1x.
  let camera = { k: 1, tx: 0, ty: 0 }

  // Blur the page while the camera moves and only then, the way a shutter smears a fast pan: the
  // strength peaks where cubic-bezier(.4,0,.2,1) is fastest, 30% into the move at 2.7x its average
  // speed, and falls off faster than the speed does: on film a blur that lasts into the settle
  // reads as a page out of focus rather than a page in motion. The size is the farthest a viewport corner
  // travels, so a push-in across the frame smears and a nudge does not. The cursor and the rest of
  // the overlay sit outside body and stay sharp, as the pointer does in a real screen recording.
  const BLUR_PROFILE = [
    [0, 0],
    [0.1, 0.15],
    [0.2, 0.55],
    [0.3, 1],
    [0.4, 0.6],
    [0.5, 0.28],
    [0.6, 0.1],
    [0.7, 0],
    [1, 0],
  ]
  const MAX_BLUR = 4

  // The first frame of a transform on body makes Chrome build a composited layer for the whole page
  // and rasterize it before it will draw the frame; on a heavy page that is ~200 ms in which the
  // capture gets no frames, and the camera then jumps a fifth of the way in at once. Promoting the
  // layer first moves that work to before the move, where a held frame is invisible. The hint comes
  // off once the move has landed, so Chrome re-rasters at the new scale and zoomed text is sharp.
  const PROMOTE_MS = 200
  let demoteTimer = null

  async function promote(el, ms) {
    clearTimeout(demoteTimer)
    if (!ms) {
      return
    }
    el.style.willChange = 'transform'
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    await new Promise((r) => setTimeout(r, PROMOTE_MS))
  }

  function demote(el, ms) {
    demoteTimer = setTimeout(() => {
      el.style.willChange = ''
    }, ms + 60)
  }

  let blurAnimation = null

  // oxlint-disable-next-line eslint/max-params -- the element, both camera states and the duration are all independent
  function motionBlur(el, from, to, ms) {
    if (!ms) {
      return
    }
    const corners = [
      [0, 0],
      [window.innerWidth, 0],
      [0, window.innerHeight],
      [window.innerWidth, window.innerHeight],
    ]
    // A point on screen at `from` sits at page point (c - t0) / k0; `to` paints it at t1 + k1 * p.
    const travel = Math.max(
      ...corners.map(([x, y]) =>
        Math.hypot(to.tx + (to.k * (x - from.tx)) / from.k - x, to.ty + (to.k * (y - from.ty)) / from.k - y),
      ),
    )
    const peak = Math.min(MAX_BLUR, travel * 0.006 * (600 / ms))
    if (peak < 0.5) {
      return
    }
    // The page's own filter, from its stylesheet as much as its style attribute, rides under the blur.
    // A blur still running from the last move is cancelled first, or it would read as the page's.
    blurAnimation?.cancel()
    const own = getComputedStyle(el).filter
    const base = own === 'none' ? '' : own
    const keyframes = BLUR_PROFILE.map(([offset, s]) => ({
      offset,
      filter: `${base} blur(${(peak * s).toFixed(2)}px)`.trim(),
    }))
    blurAnimation = el.animate(keyframes, { duration: ms, easing: 'linear' })
  }

  function mount() {
    if (document.getElementById('__demo_layer')) {
      return
    }
    if (!document.documentElement) {
      return
    }

    const root = document.createElement('div')
    root.id = '__demo_layer'
    root.style.cssText = `position:fixed;inset:0;z-index:${Z};pointer-events:none;overflow:hidden`

    const cursor = document.createElement('div')
    cursor.id = '__demo_cursor'
    // The layer's only z-index: the cursor paints over every other effect.
    cursor.style.cssText = `position:absolute;z-index:1;width:${theme.cursorSize}px;height:${theme.cursorSize}px;left:0;top:0;will-change:transform,opacity;opacity:${state.hidden ? 0 : 1}`
    cursor.innerHTML = markupFor(glyph)

    root.appendChild(cursor)
    document.documentElement.appendChild(root)
    apply()
  }

  function layer() {
    mount()
    const el = document.getElementById('__demo_layer')
    if (!el) {
      throw new Error('__demo: no overlay layer (document not ready)')
    }
    return el
  }

  // Redraw the pointer for what is under it now. The glyph can go stale with the mouse still: the
  // button it was over re-renders away after a click, a panel closes, a zoom or navigation changes
  // what sits at that point. So this runs on every mouse event and again from the refresh loop.
  function apply() {
    const el = document.getElementById('__demo_cursor')
    if (el) {
      const next = glyphAt(state.x, state.y)
      if (next !== glyph) {
        glyph = next
        el.innerHTML = markupFor(glyph)
        if (state.pressed) {
          window.__demo.pressed(true)
        }
      }
      const [hx, hy] = hotspot()
      el.style.transform = `translate(${snap(state.x - hx)}px,${snap(state.y - hy)}px)`
    }
  }

  function remember() {
    try {
      sessionStorage.setItem(CURSOR_KEY, JSON.stringify({ x: state.x, y: state.y, hidden: Boolean(state.hidden) }))
    } catch {
      /* storage can be unavailable; the position then resets on navigation */
    }
  }

  // While the mouse is still, re-check what is under it about ten times a second. It rides on
  // requestAnimationFrame, so it ticks exactly while frames are being produced and captured, and
  // costs one elementFromPoint plus one getComputedStyle per tick.
  const REFRESH_MS = 100
  let lastRefresh = 0
  function refresh(now) {
    if (now - lastRefresh >= REFRESH_MS) {
      lastRefresh = now
      apply()
    }
    requestAnimationFrame(refresh)
  }

  const textStyle =
    `font:500 ${theme.fontSize}px/${Math.round(theme.fontSize * 1.35)}px ${theme.font};` +
    `letter-spacing:.01em;white-space:nowrap;max-width:70vw;overflow:hidden;text-overflow:ellipsis;`

  function timed(el, ms, { enter, exit }) {
    if (!el.isConnected) {
      layer().appendChild(el)
    }
    el.animate(enter, { duration: 260, easing: 'ease-out', fill: 'both' })
    setTimeout(() => {
      el.animate(exit, { duration: 260, easing: 'ease-in', fill: 'forwards' }).onfinish = () => el.remove()
    }, ms)
  }

  function textRects() {
    const rects = []
    const range = document.createRange()
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      range.selectNodeContents(node)
      const visible = node.data.trim() ? [...range.getClientRects()] : []
      for (const r of visible) {
        if (
          r.width &&
          r.height &&
          r.bottom > 0 &&
          r.right > 0 &&
          r.top < window.innerHeight &&
          r.left < window.innerWidth
        ) {
          rects.push(r)
        }
      }
    }
    return rects
  }

  function overlap(a, b) {
    return (
      Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
      Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
    )
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v))
  }

  function pinPlace(b, w, h) {
    const margin = 12
    const vw = window.innerWidth
    const vh = window.innerHeight
    const candidates = []
    for (const stalk of [26, 64, 112]) {
      candidates.push(
        ['below', stalk, b.x + b.width / 2 - w / 2, b.y + b.height + stalk],
        ['above', stalk, b.x + b.width / 2 - w / 2, b.y - stalk - h],
      )
    }
    for (const stalk of [26, 56]) {
      candidates.push(
        ['right', stalk, b.x + b.width + stalk, b.y + b.height / 2 - h / 2],
        ['left', stalk, b.x - stalk - w, b.y + b.height / 2 - h / 2],
      )
    }
    const text = textRects()
    let best = null
    for (const [side, stalk, x0, y0] of candidates) {
      const x = clamp(x0, margin, vw - w - margin)
      const y = clamp(y0, margin, vh - h - margin)
      const rect = { x, y, width: w, height: h }
      const offscreen = reaches(b, side, rect) && (isVertical(side) ? y === y0 : x === x0) ? 0 : 1e9
      const onTarget = overlap(rect, b) > 0 ? 1e12 : 0
      const hidden = text.reduce((sum, r) => {
        const area = overlap(rect, r)
        return area > 0 ? sum + 2000 + area : sum
      }, 0)
      const cost = offscreen + onTarget + (stalk - 26) * 40 + hidden
      if (!best || cost < best.cost) {
        best = { side, stalk, x, y, cost }
      }
    }
    return best
  }

  function isVertical(side) {
    return side === 'below' || side === 'above'
  }

  function reaches(b, side, { x, y, width: w, height: h }) {
    if (isVertical(side)) {
      return Math.max(x + h / 2, b.x) <= Math.min(x + w - h / 2, b.x + b.width)
    }
    return y + h / 2 >= b.y && y + h / 2 <= b.y + b.height
  }

  function stalkGeometry(b, { side, stalk, x, y }, [w, h]) {
    if (isVertical(side)) {
      const ax = clamp(b.x + b.width / 2, Math.max(x + h / 2, b.x), Math.min(x + w - h / 2, b.x + b.width))
      const ay = side === 'below' ? b.y + b.height : b.y
      return { anchor: [ax, ay], line: [ax - 1, side === 'below' ? ay : y + h, 2, stalk] }
    }
    const ay = y + h / 2
    const ax = side === 'right' ? b.x + b.width : b.x
    return { anchor: [ax, ay], line: [side === 'right' ? ax : x + w, ay - 1, stalk, 2] }
  }

  function pillFor(text) {
    const pill = document.createElement('div')
    pill.style.cssText =
      `position:absolute;display:flex;align-items:center;gap:9px;padding:8px 16px 8px 12px;border-radius:999px;` +
      `background:${theme.calloutBg};color:${theme.calloutFg};` +
      `box-shadow:inset 0 0 0 1.5px ${theme.calloutBorder},0 8px 24px rgba(0,0,0,.16)`
    const dot = document.createElement('span')
    dot.style.cssText = `flex:none;width:9px;height:9px;border-radius:50%;background:${theme.accent}`
    const label = document.createElement('span')
    label.textContent = text
    label.style.cssText = `display:block;${textStyle}font-weight:600`
    pill.append(dot, label)
    return pill
  }

  function placement(b, text) {
    const probe = pillFor(text)
    probe.style.visibility = 'hidden'
    layer().appendChild(probe)
    const size = [probe.offsetWidth, probe.offsetHeight]
    probe.remove()
    const { side, stalk, x, y } = pinPlace(b, ...size)
    return { side, stalk, x, y, width: size[0], height: size[1] }
  }

  function pin(b, text, ms) {
    const group = document.createElement('div')
    group.style.cssText = 'position:absolute;inset:0'
    const label = pillFor(text)
    group.appendChild(label)
    layer().appendChild(group)

    const w = label.offsetWidth
    const h = label.offsetHeight
    const place = pinPlace(b, w, h)
    label.style.left = `${snap(place.x)}px`
    label.style.top = `${snap(place.y)}px`

    const {
      anchor: [ax, ay],
      line: [lx, ly, lw, lh],
    } = stalkGeometry(b, place, [w, h])
    const line = document.createElement('div')
    line.style.cssText =
      `position:absolute;left:${snap(lx)}px;top:${snap(ly)}px;width:${snap(lw)}px;height:${snap(lh)}px;` +
      `background:${theme.accent}`
    const anchor = document.createElement('div')
    anchor.style.cssText =
      `position:absolute;left:${snap(ax - 4)}px;top:${snap(ay - 4)}px;width:8px;height:8px;border-radius:50%;` +
      `background:${theme.accent};box-shadow:0 0 0 2px ${theme.calloutBg}`
    group.prepend(line, anchor)

    timed(group, ms, {
      enter: [{ opacity: 0 }, { opacity: 1 }],
      exit: [{ opacity: 1 }, { opacity: 0 }],
    })
  }

  window.__demo = {
    caption(text, ms = 2500) {
      document.getElementById('__demo_caption')?.remove()
      const pill = document.createElement('div')
      pill.id = '__demo_caption'
      pill.textContent = text
      pill.style.cssText =
        `position:absolute;bottom:${snap(window.innerHeight * 0.06)}px;padding:10px 18px;` +
        `border-radius:999px;background:${theme.captionBg};color:${theme.captionFg};` +
        `box-shadow:0 6px 24px rgba(0,0,0,.28),inset 0 0 0 1px rgba(255,255,255,.12);${textStyle}`
      layer().appendChild(pill)
      pill.style.left = `${snap((window.innerWidth - pill.offsetWidth) / 2)}px`
      timed(pill, ms, {
        enter: [
          { opacity: 0, transform: 'translateY(12px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        exit: [
          { opacity: 1, transform: 'translateY(0)' },
          { opacity: 0, transform: 'translateY(8px)' },
        ],
      })
    },

    place(b, text) {
      return placement(b, text)
    },

    callout(b, text, ms = 2500) {
      if (theme.callout === 'pin') {
        pin(b, text, ms)
        return
      }
      const gap = 12
      const margin = 12
      const below = b.y + b.height + gap + 48 < window.innerHeight
      const tag = document.createElement('div')
      // The ellipsis clip lives on the label, not the tag, or it would clip the arrow too.
      const label = document.createElement('span')
      label.textContent = text
      label.style.cssText = `display:block;${textStyle}`
      tag.appendChild(label)
      const cx = b.x + b.width / 2
      const y = below ? b.y + b.height + gap : b.y - gap
      tag.style.cssText =
        `position:absolute;top:${snap(y)}px;transform:translateY(${below ? '0' : '-100%'});` +
        `padding:8px 14px;border-radius:8px;background:${theme.accent};color:#fff;` +
        `box-shadow:0 6px 20px ${tint(45)}`
      layer().appendChild(tag)
      const left = snap(
        Math.max(margin, Math.min(cx - tag.offsetWidth / 2, window.innerWidth - tag.offsetWidth - margin)),
      )
      tag.style.left = `${left}px`
      const arrow = document.createElement('div')
      const arrowLeft = Math.max(8, Math.min(cx - left - 5, tag.offsetWidth - 18))
      arrow.style.cssText =
        `position:absolute;left:${snap(arrowLeft)}px;${below ? 'top:-5px' : 'bottom:-5px'};width:10px;height:10px;` +
        `background:${theme.accent};transform:rotate(45deg)`
      tag.appendChild(arrow)
      const from = below ? '-6px' : '6px'
      const base = `translateY(${below ? '0' : '-100%'})`
      timed(tag, ms, {
        enter: [
          { opacity: 0, transform: `${base} translateY(${from})` },
          { opacity: 1, transform: base },
        ],
        exit: [
          { opacity: 1, transform: base },
          { opacity: 0, transform: `${base} translateY(${from})` },
        ],
      })
    },

    // body, not documentElement: portaled dialogs zoom with the page while this layer does not.
    // `cx`/`cy` are viewport coordinates and the transform runs in body layout space, so the
    // scroll offset enters the translate and the clamp measures the scaled document.
    // oxlint-disable-next-line eslint/max-params -- called positionally from the driver through page.evaluate
    async zoom(k, { x: cx, y: cy }, ms = 600, blur = true) {
      const body = document.body
      const vw = window.innerWidth
      const vh = window.innerHeight
      const sx = window.scrollX
      const sy = window.scrollY
      const w = Math.max(body.scrollWidth, vw)
      const h = Math.max(body.scrollHeight, vh)
      const tx = Math.min(sx, Math.max(vw - k * w + sx, vw / 2 - k * cx - (k - 1) * sx))
      const ty = Math.min(sy, Math.max(vh - k * h + sy, vh / 2 - k * cy - (k - 1) * sy))
      await promote(body, ms)
      body.style.transformOrigin = '0 0'
      body.style.transition = ms ? `transform ${ms}ms cubic-bezier(.4,0,.2,1)` : ''
      body.style.transform = `translate(${tx}px,${ty}px) scale(${k})`
      if (blur) {
        motionBlur(body, camera, { k, tx, ty }, ms)
      }
      demote(body, ms)
      camera = { k, tx, ty }
    },

    async unzoom(ms = 600, blur = true) {
      const body = document.body
      await promote(body, ms)
      body.style.transition = ms ? `transform ${ms}ms cubic-bezier(.4,0,.2,1)` : ''
      body.style.transform = ''
      if (blur) {
        motionBlur(body, camera, { k: 1, tx: 0, ty: 0 }, ms)
      }
      demote(body, ms)
      camera = { k: 1, tx: 0, ty: 0 }
    },

    // Hide or show the pointer, faded. The state rides in sessionStorage with the position, so a
    // cursor hidden before a navigation mounts hidden on the next page instead of popping in.
    // Returns whether anything changed, so the caller only waits out a fade that happened.
    fade(visible, ms = 180) {
      state.hidden = !visible
      remember()
      const el = document.getElementById('__demo_cursor')
      if (!el) {
        return false
      }
      const to = visible ? 1 : 0
      const from = Number(getComputedStyle(el).opacity)
      el.style.opacity = String(to)
      if (ms && from !== to) {
        el.animate([{ opacity: from }, { opacity: to }], { duration: ms, easing: 'ease-out' })
      }
      return from !== to
    },

    position() {
      return { x: state.x, y: state.y }
    },

    glyph() {
      return glyph
    },

    // A hairline ring, not a filled disc: it opens out from the hotspot to a third larger than the
    // cursor and fades as it goes, decelerating. Its tone is the opposite of the surface it lands on,
    // with a faint halo in the other, so a button that changes colour as it is pressed still shows it.
    ripple(x = state.x, y = state.y, ms = 450) {
      // A third larger than the cursor, rounded to an even number so the centring margin is whole and
      // the ring opens out from exactly the point snap() put it on.
      const size = Math.round((theme.cursorSize * 1.35) / 2) * 2
      const [line, halo] = darkAt(x, y)
        ? ['rgba(255,255,255,.95)', 'rgba(0,0,0,.3)']
        : ['rgba(10,10,10,.75)', 'rgba(255,255,255,.5)']
      const ring = document.createElement('div')
      ring.style.cssText =
        `position:absolute;left:${snap(x)}px;top:${snap(y)}px;width:${size}px;height:${size}px;` +
        `margin:${-size / 2}px 0 0 ${-size / 2}px;will-change:transform,opacity;box-sizing:border-box;` +
        `border-radius:50%;border:2px solid ${line};` +
        `box-shadow:0 0 0 1px ${halo},inset 0 0 0 1px ${halo}`
      layer().appendChild(ring)
      // The scale decelerates while the opacity holds, so the ring is seen open before it goes.
      ring.animate([{ transform: 'scale(.35)' }, { transform: 'scale(1)' }], {
        duration: ms,
        easing: 'cubic-bezier(.2,.7,.3,1)',
        fill: 'forwards',
      })
      ring.animate([{ opacity: 1 }, { opacity: 1, offset: 0.35 }, { opacity: 0 }], {
        duration: ms,
        easing: 'ease-in',
        fill: 'forwards',
      }).onfinish = () => ring.remove()
    },

    // The pointer shrinks to 0.8 around its hotspot while a button is down and springs back on release.
    pressed(down) {
      state.pressed = Boolean(down)
      const el = document.querySelector('#__demo_cursor > *')
      if (el) {
        const [hx, hy] = hotspot()
        el.style.transformOrigin = `${hx}px ${hy}px`
        el.style.transition = 'scale 80ms ease-out'
        el.style.scale = state.pressed ? '.8' : '1'
      }
    },

    highlight(b, ms = 1800, pad = 8) {
      const edge = theme.ring
        ? `inset 0 0 0 2px #fff,0 0 0 3px ${theme.ring},0 0 24px 4px ${tint(35)},0 0 0 9999px ${theme.scrim}`
        : `0 0 0 9999px ${theme.scrim},0 0 22px ${tint(75)}`
      const box = document.createElement('div')
      box.style.cssText =
        `position:absolute;left:${snap(b.x - pad)}px;top:${snap(b.y - pad)}px;` +
        `width:${snap(b.width + pad * 2)}px;height:${snap(b.height + pad * 2)}px;border-radius:10px;` +
        `box-shadow:${edge}`
      layer().appendChild(box)
      box.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, fill: 'both' })
      setTimeout(() => {
        box.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 260,
          fill: 'forwards',
        }).onfinish = () => box.remove()
      }, ms)
    },
  }

  function boot() {
    // A new origin has no sessionStorage, so a `goto` the driver makes there seeds the pointer in an
    // init script of its own; that runs after this one, but before the document exists and so before
    // boot. Only for the origins it names, and only when this one has nothing stored.
    const seed = window.__demoSeed
    if (!('x' in stored) && seed?.origins.includes(location.origin)) {
      Object.assign(state, seed.state)
    }
    mount()
    if (alreadyInstalled) {
      return
    }
    // A framework re-render can replace documentElement's children and take the layer with it.
    new MutationObserver(mount).observe(document.documentElement, { childList: true })
    requestAnimationFrame(refresh)
    document.addEventListener(
      'mousemove',
      (event) => {
        state.x = event.clientX
        state.y = event.clientY
        apply()
        remember()
      },
      true,
    )
    document.addEventListener(
      'mousedown',
      (event) => {
        state.x = event.clientX
        state.y = event.clientY
        apply()
        remember()
        window.__demo.ripple(event.clientX, event.clientY)
        window.__demo.pressed(true)
      },
      true,
    )
    document.addEventListener('mouseup', () => window.__demo.pressed(false), true)
  }

  // documentElement appears ~3 ms after this runs; DOMContentLoaded waits for the app's module scripts.
  if (document.documentElement) {
    boot()
  } else {
    new MutationObserver((_, observer) => {
      if (document.documentElement) {
        observer.disconnect()
        boot()
      }
    }).observe(document, { childList: true })
  }
})()
