(function () {
  const cloud = document.getElementById('tag-cloud');
  const grid = document.getElementById('video-grid');
  const countEl = document.getElementById('video-count');
  const activeBanner = document.getElementById('active-tag');
  const activeTagName = document.getElementById('active-tag-name');
  const clearBtn = document.getElementById('clear-tag');

  let allVideos = [];
  let tagMap = {}; // tag -> [video, ...]

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function buildTagMap(videos) {
    const map = {};
    for (const v of videos) {
      const allTags = [...(v.tags || []), ...(v.categories || [])];
      for (const tag of allTags) {
        const key = tag.toLowerCase();
        if (!map[key]) map[key] = { label: tag, videos: [] };
        map[key].videos.push(v);
      }
    }
    return map;
  }

  function renderCloud(activeTag) {
    const sorted = Object.values(tagMap).sort((a, b) => b.videos.length - a.videos.length);
    cloud.innerHTML = sorted.map(t => {
      const active = activeTag && t.label.toLowerCase() === activeTag.toLowerCase();
      return `<button class="tag-pill${active ? ' tag-pill--active' : ''}" data-tag="${escapeHtml(t.label)}">${escapeHtml(t.label)} <span class="tag-count">${t.videos.length}</span></button>`;
    }).join('');
  }

  function renderCard(video) {
    return `<a href="/watch/${video.id}.html" class="card">
      <div class="thumb">
        <img src="/thumbs/${video.id}${video.thumbExt}" alt="${escapeHtml(video.title)}" loading="lazy">
        <span class="duration">${escapeHtml(video.durationString)}</span>
      </div>
      <div class="meta">
        <h3>${escapeHtml(video.title)}</h3>
        <div class="channel">${escapeHtml(video.channel)}</div>
        <div class="date">${escapeHtml(video.uploadDate || '')}</div>
      </div>
    </a>`;
  }

  function showTag(tag) {
    const key = tag.toLowerCase();
    const entry = tagMap[key];
    if (!entry) return;

    activeBanner.style.display = 'flex';
    activeTagName.textContent = entry.label;
    countEl.style.display = 'block';
    countEl.textContent = `${entry.videos.length} video${entry.videos.length === 1 ? '' : 's'}`;
    grid.innerHTML = entry.videos.map(renderCard).join('');
    renderCloud(tag);

    const params = new URLSearchParams();
    params.set('tag', tag);
    history.replaceState(null, '', `?${params}`);
  }

  function clearTag() {
    activeBanner.style.display = 'none';
    countEl.style.display = 'none';
    grid.innerHTML = '';
    renderCloud(null);
    history.replaceState(null, '', '/tags.html');
  }

  async function init() {
    try {
      const res = await fetch('/api/videos.json');
      const data = await res.json();
      allVideos = data.videos;
    } catch (e) {
      cloud.innerHTML = '<p style="color:#f44">Failed to load videos.</p>';
      return;
    }

    tagMap = buildTagMap(allVideos);
    renderCloud(null);

    cloud.addEventListener('click', e => {
      const btn = e.target.closest('[data-tag]');
      if (btn) showTag(btn.dataset.tag);
    });

    clearBtn.addEventListener('click', clearTag);

    const params = new URLSearchParams(location.search);
    if (params.has('tag')) showTag(params.get('tag'));
  }

  init();
})();
