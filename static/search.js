(function () {
  const grid = document.getElementById('video-grid');
  const searchInput = document.getElementById('search');
  const channelFilter = document.getElementById('channel-filter');
  const sortSelect = document.getElementById('sort-by');
  const countEl = document.getElementById('video-count');

  let allVideos = [];

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
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

  function matchesSearch(video, query) {
    if (!query) return true;
    const q = query.toLowerCase();
    const fields = [
      video.title,
      video.channel,
      ...(video.tags || []),
      ...(video.categories || []),
    ];
    return fields.some(f => f && f.toLowerCase().includes(q));
  }

  function sortVideos(videos, key) {
    const sorted = [...videos];
    switch (key) {
      case 'added-desc': return sorted.sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''));
      case 'added-asc': return sorted.sort((a, b) => (a.addedAt || '').localeCompare(b.addedAt || ''));
      case 'date-desc': return sorted.sort((a, b) => (b.uploadDate || '').localeCompare(a.uploadDate || ''));
      case 'date-asc': return sorted.sort((a, b) => (a.uploadDate || '').localeCompare(b.uploadDate || ''));
      case 'duration-desc': return sorted.sort((a, b) => b.duration - a.duration);
      case 'duration-asc': return sorted.sort((a, b) => a.duration - b.duration);
      case 'title-asc': return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case 'title-desc': return sorted.sort((a, b) => b.title.localeCompare(a.title));
      default: return sorted;
    }
  }

  function render() {
    const query = searchInput.value.trim();
    const channel = channelFilter.value;
    const sort = sortSelect.value;

    let filtered = allVideos.filter(v => matchesSearch(v, query));
    if (channel) filtered = filtered.filter(v => v.channel === channel);
    filtered = sortVideos(filtered, sort);

    grid.innerHTML = filtered.map(renderCard).join('');
    countEl.textContent = `${filtered.length} of ${allVideos.length} videos`;

    // Update URL params
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (channel) params.set('channel', channel);
    if (sort !== 'added-desc') params.set('sort', sort);
    const qs = params.toString();
    history.replaceState(null, '', qs ? `?${qs}` : '/');
  }

  function populateChannels() {
    const channels = [...new Set(allVideos.map(v => v.channel))].sort();
    channels.forEach(ch => {
      const opt = document.createElement('option');
      opt.value = ch;
      opt.textContent = ch;
      channelFilter.appendChild(opt);
    });
  }

  function restoreFromUrl() {
    const params = new URLSearchParams(location.search);
    if (params.has('q')) searchInput.value = params.get('q');
    if (params.has('channel')) channelFilter.value = params.get('channel');
    if (params.has('sort')) sortSelect.value = params.get('sort');
  }

  async function init() {
    try {
      const res = await fetch('/api/videos.json');
      const data = await res.json();
      allVideos = data.videos;
    } catch (e) {
      grid.innerHTML = '<p style="color:#f44">Failed to load videos.</p>';
      return;
    }

    populateChannels();
    restoreFromUrl();
    render();

    searchInput.addEventListener('input', render);
    channelFilter.addEventListener('change', render);
    sortSelect.addEventListener('change', render);
  }

  init();
})();
