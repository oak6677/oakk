(function () {
  var SAMPLES = [
    { id: 1, name: 'Ring ဆွဲပြီး ပေါ်လာမယ်', desc: 'logo ရဲ့ အစိမ်းနဲ့ အပြာ ring နှစ်ပိုင်း ဆွဲလာပြီး တာဝါတိုင် ပေါ်လာတယ်။ ရိုးရှင်းပြီး app logo နဲ့ အကိုက်ညီဆုံး။' },
    { id: 2, name: 'လိုင်းလွင့်ပေါက်ကွဲ', desc: 'logo ပေါ်လာပြီး ရင်ခုန်သံလို လှိုင်းကွင်း သုံးထပ် ပြင်ပကို ပျံ့သွားတယ်။' },
    { id: 3, name: 'တာဝါတိုင် မြင့်တက်', desc: 'တာဝါတိုင် မြေကြီးပေါ်က ပေါက်တက်လာပြီး signal လှိုင်း ၃ ထပ် တစ်ထပ်ချင်း လွင့်ထွက်တယ်။' },
    { id: 4, name: 'Radar ရှာဖွေ', desc: 'radar လှည့်ရှာသလို အလင်းတန်း ပတ်သွားပြီး logo ကို မှုန်ဝါးကနေ ထင်ရှားစေတယ်။' },
    { id: 5, name: 'ဇူးမ်ဖြတ်ဝင်', desc: 'logo ကို အနီးကပ်ကနေ အဝေးကို ဆွဲထုတ်သလို ဝင်လာပြီး အစိမ်းရောင် အလင်းလက်တယ်။' },
    { id: 6, name: 'စာလုံး တစ်လုံးချင်းကျ', desc: 'logo လည်ပြီး ရောက်လာကာ Oak_K စာလုံးတွေ အပေါ်ကနေ တစ်လုံးချင်း ကျလာတယ်။' },
    { id: 7, name: 'အမှုန့်တွေ စုဝင်', desc: 'ပတ်ဝန်းကျင်က အစိမ်းအမှုန်လေးတွေ အလယ်ကို စုပြီး logo ဖြစ်လာတယ်။ အချိတ်အဆက်လို့ ခံစားရတယ်။' },
    { id: 8, name: 'ကုလားကာ ဖွင့်', desc: 'ဘယ်ညာ အကာနှစ်ခု ဘေးကို ပွင့်ထွက်သွားပြီး အထဲက logo ကို ပြတယ်။ ဖွင့်ပွဲ stage ပုံစံ။' },
    { id: 9, name: 'Scan ပြီး Connected', desc: 'အလင်းတန်း အပေါ်ကနေ အောက်ကို scan ဖတ်ပြီး logo တောက်လာကာ “PROTECTED” ဆိုတဲ့ တံဆိပ် ပေါ်တယ်။' },
    { id: 10, name: 'မိုးသောက် အလင်းရောင်', desc: 'အောက်ခြေက အစိမ်းရောင် အလင်း ကြည်လာပြီး ညမှောင်ထဲက တာဝါတိုင် ထင်းလာတယ်။' }
  ];

  var NS = 'http://www.w3.org/2000/svg';
  var grid = document.getElementById('grid');
  var picked = document.getElementById('picked');
  var playAllBtn = document.getElementById('playAll');
  var rmNote = document.getElementById('rmNote');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) rmNote.hidden = false;

  function markSvg() {
    return '<div class="mark"><svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">' +
      '<g transform="rotate(-90 60 60)">' +
      '<circle class="ring-base" cx="60" cy="60" r="44" pathLength="100"/>' +
      '<circle class="ring-arc" cx="60" cy="60" r="44" pathLength="100"/>' +
      '<circle class="ring-blue" cx="60" cy="60" r="44" pathLength="100"/></g>' +
      '<g class="tower"><g transform="translate(34 30) scale(.8)">' +
      '<g><path class="tw-wave w1" d="M25.6 15.6A9 9 0 0 0 25.6 28.4M38.4 15.6A9 9 0 0 1 38.4 28.4"/>' +
      '<path class="tw-wave w2" d="M20.7 10.7A16 16 0 0 0 20.7 33.3M43.3 10.7A16 16 0 0 1 43.3 33.3"/>' +
      '<path class="tw-wave w3" d="M15.7 5.7A23 23 0 0 0 15.7 38.3M48.3 5.7A23 23 0 0 1 48.3 38.3"/></g>' +
      '<path class="tw-body" d="M32 20.5L19.5 69h6.2l1.6-8.5h17.4l1.6 8.5h6.2z"/>' +
      '<path class="tw-cross" d="M24 44h16M21.6 54h20.8M28 61l8-17M36 61l-8-17M27 44l9-10M37 44l-9-10"/>' +
      '<circle class="tw-body" cx="32" cy="22" r="3.4"/></g></g></svg></div>';
  }

  function word(letters) {
    if (!letters) return '<div class="word" aria-hidden="true">Oak<b>_K</b></div>';
    var s = 'Oak_K'.split('').map(function (c, i) {
      return '<span style="--i:' + i + '"' + (i > 2 ? ' class="accent"' : '') + '>' + c + '</span>';
    }).join('');
    return '<div class="word" aria-hidden="true">' + s + '</div>';
  }

  function extras(id) {
    switch (id) {
      case 2: return '<i class="rip"></i><i class="rip"></i><i class="rip"></i>';
      case 4: return '<i class="sweep"></i>';
      case 5: return '<i class="fx"></i>';
      case 7:
        var d = '';
        for (var i = 0; i < 24; i++) {
          var a = (i / 24) * Math.PI * 2, r = 110 + (i % 3) * 18;
          d += '<i class="dot" style="--i:' + i + ';--x:' + Math.round(Math.cos(a) * r) + 'px;--y:' + Math.round(Math.sin(a) * r) + 'px"></i>';
        }
        return d;
      case 8: return '<i class="curtain l"></i><i class="curtain r"></i>';
      case 9: return '<i class="scan"></i>';
      case 10: return '<i class="glow"></i>';
      default: return '';
    }
  }

  function stageHtml(id) {
    var chip = id === 9 ? '<span class="chip">PROTECTED</span>' : '';
    return '<div class="stage s' + id + '" role="img" aria-label="နမူနာ ' + id + ' animation ကြည့်ရန်နေရာ">' +
      extras(id) +
      '<div class="lockup">' + markSvg() + word(id === 6) + '<div class="tag">တစ်ချက်နှိပ်ရုံနဲ့ ဘေးကင်းပါပြီ</div></div>' +
      chip + '</div>';
  }

  var cards = [];
  SAMPLES.forEach(function (s) {
    var li = document.createElement('li');
    li.className = 'card';
    li.innerHTML = stageHtml(s.id) +
      '<div class="card-body"><h2><span>' + String(s.id).padStart(2, '0') + '</span>' + s.name + '</h2><p>' + s.desc + '</p>' +
      '<div class="card-actions"><button class="btn replay" type="button">ပြန်ကြည့်မည်</button>' +
      '<button class="btn pick" type="button" aria-pressed="false">ဒါကို ရွေးမည်</button></div></div>';
    grid.appendChild(li);
    var stage = li.querySelector('.stage');
    var item = { s: s, li: li, stage: stage, played: false };
    cards.push(item);
    li.querySelector('.replay').addEventListener('click', function () { play(item); });
    li.querySelector('.pick').addEventListener('click', function () { pick(item); });
  });

  function play(item) {
    item.played = true;
    item.stage.classList.remove('play');
    void item.stage.offsetWidth;
    item.stage.classList.add('play');
  }

  function pick(item) {
    var already = item.li.classList.contains('picked-card');
    cards.forEach(function (c) {
      c.li.classList.remove('picked-card');
      var b = c.li.querySelector('.pick');
      b.setAttribute('aria-pressed', 'false');
      b.textContent = 'ဒါကို ရွေးမည်';
    });
    if (already) { picked.textContent = 'ရွေးထားတာ မရှိသေးပါ'; return; }
    item.li.classList.add('picked-card');
    var b = item.li.querySelector('.pick');
    b.setAttribute('aria-pressed', 'true');
    b.textContent = 'ရွေးထားပါပြီ ✓';
    picked.innerHTML = 'ရွေးထားတာ: <b>နံပါတ် ' + item.s.id + '</b> · ' + item.s.name + ' — chat မှာ “' + item.s.id + ' ကို သုံးပါ” လို့ ပြောပါ';
  }

  playAllBtn.addEventListener('click', function () {
    cards.forEach(function (c, i) { setTimeout(function () { play(c); }, i * 120); });
  });

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var item = cards.filter(function (c) { return c.stage === e.target; })[0];
        if (item && !item.played) play(item);
        io.unobserve(e.target);
      });
    }, { threshold: 0.5 });
    cards.forEach(function (c) { io.observe(c.stage); });
  } else {
    cards.forEach(play);
  }
})();
