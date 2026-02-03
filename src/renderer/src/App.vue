<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue'
import soulIcon from './assets/spr_soul.png'
import { Conf } from 'electron-conf/renderer'

const conf = new Conf()

// --- I18N ---
const I18N = {
    zh: {
        search: "搜索世界...",
        import: "[ 导入 ]",
        delete: "[ 删除 ]",
        play: "[ 游玩 ]",
        download: "[ 前往下载 ]",
        installed: "已就绪",
        to_download: "未下载",
        settings: "[ 设置 ]",
        settings_title: "设置",
        settings_import_name_label: "本地导入游戏名称",
        settings_import_image_label: "本地导入游戏图片",
        settings_choose_image: "选择图片",
        settings_image_not_chosen: "(未选择)",
        settings_download_path_label: "游戏下载路径",
        settings_game_path_label: "游戏可执行文件路径",
        settings_browse: "浏览",
        settings_save: "保存",
        settings_cancel: "取消",
        confirm_del: "确定从列表中移除或重置该项吗？",
        confirm_yes: "是",
        confirm_no: "否",
        prompt_import_name: "游戏名称:",
        alert_launching: "启动中",
        alert_opening_url: "正在打开下载页面",
        placeholder_game_name: "游戏名称",
        placeholder_download_path: "/path/to/downloads",
        load_more: "↓ 加载更多"  // [新增]
    },
    en: {
        search: "SEARCH UNIVERSE...",
        import: "[ IMPORT ]",
        delete: "[ DELETE ]",
        play: "[ PLAY ]",
        download: "[ DOWNLOAD ]",
        installed: "INSTALLED",
        to_download: "DOWNLOADABLE",
        settings: "[ SETTINGS ]",
        settings_title: "Settings",
        settings_import_name_label: "Local Import Game Name",
        settings_import_image_label: "Local Import Game Image",
        settings_choose_image: "Choose Image",
        settings_image_not_chosen: "(Not chosen)",
        settings_download_path_label: "Game Download Path",
        settings_game_path_label: "Game Executable Path",
        settings_browse: "Browse",
        settings_save: "Save",
        settings_cancel: "Cancel",
        confirm_del: "Are you sure to remove or reset this item?",
        confirm_yes: "Yes",
        confirm_no: "No",
        prompt_import_name: "Game Name:",
        alert_launching: "Launching",
        alert_opening_url: "Opening download page for",
        placeholder_game_name: "Game name",
        placeholder_download_path: "/path/to/downloads",
        load_more: "↓ SHOW MORE" // [新增]
    }
};

// --- SFX ---
const sfx: { [key: string]: HTMLAudioElement } = {};
function initSfx() {
    const SFX_PATHS = {
        confirm: './src/assets/sfx/confirm.wav',
        cancel: './src/assets/sfx/cancel.wav',
        switch: './src/assets/sfx/switch.wav'
    };
    try {
        for (const k of Object.keys(SFX_PATHS)) {
            const aud = new Audio(SFX_PATHS[k]);
            aud.preload = 'auto';
            sfx[k] = aud;
        }
    } catch (e) { console.warn('initSfx load failed', e); }
}
function playSfx(name: string) {
    try {
        if (sfx[name]) {
            sfx[name].currentTime = 0;
            sfx[name].play();
        }
    } catch (err) { console.warn('playSfx error', err); }
}


// --- Reactive State ---
const searchInput = ref('');
const GITHUB_GAMES = ref<any[]>([]);
const userGames = ref<any[]>([]);
const settings = ref({
    downloadPath: '',
    backgroundImage: '',
    lang: 'en',
    gamePath: ''
});
const currentLang = computed(() => settings.value.lang);
const selectedIndex = ref(0);
const visibleCount = ref(5); // [新增] 默认显示5个

const showConfirmDelete = ref(false);
const gameToDelete = ref<any>(null);

const showSettings = ref(false);
const settingsForm = reactive({
    name: '',
    image: null as File | null,
    imageName: computed(()=>(I18N[currentLang.value] || I18N.en).settings_image_not_chosen),
    downloadPath: '',
    gamePath: '',
});


// --- Computed Properties ---
const lang = computed(() => I18N[currentLang.value] || I18N.en);

const fullList = computed(() => {
    const gameMap = new Map();
    userGames.value.forEach(g => gameMap.set(g.id, { ...g, type: 'local' }));
    GITHUB_GAMES.value.forEach(g => {
        if (!gameMap.has(g.id)) {
            gameMap.set(g.id, { ...g, type: 'remote' });
        }
    });
    return Array.from(gameMap.values());
});

const filteredList = computed(() => {
    const query = searchInput.value.toLowerCase();
    if (!query) return fullList.value;
    return fullList.value.filter(g =>
        (g.en_name?.toLowerCase().includes(query) ||
         g.cn_name?.toLowerCase().includes(query))
    );
});

// [新增] 根据 visibleCount 切割列表
const visibleList = computed(() => {
    return filteredList.value.slice(0, visibleCount.value);
});

// 注意：activeGame 仍基于 filteredList 计算索引，确保逻辑一致性
// 如果需要仅在可视范围内选择，可改为 visibleList.value[selectedIndex.value]
// 但考虑到键盘操作习惯，通常保持全局索引更好。这里为配合UI点击，逻辑保持不变。
const activeGame = computed(() => filteredList.value[selectedIndex.value] || null);

// --- Methods ---

function selectGame(index: number) {
    playSfx('switch');
    selectedIndex.value = index;
}

// [新增] 加载更多
function loadMore() {
    playSfx('confirm');
    visibleCount.value += 5;
}

// [新增] 监听搜索，重置显示数量
watch(searchInput, () => {
    visibleCount.value = 5;
    selectedIndex.value = 0;
});

function toggleLang() {
    playSfx('switch');
    settings.value.lang = currentLang.value === 'en' ? 'zh' : 'en';
    conf.set('settings', settings.value);
}

function handleAction() {
    if (!activeGame.value) return;
    playSfx('confirm');
    const gameName = currentLang.value === 'en' ? activeGame.value.en_name : activeGame.value.cn_name;
    if (activeGame.value.type === 'local') {
        alert(`${lang.value.alert_launching} ${gameName}...`);
        // window.api.launchGame(activeGame.value.id);
    } else {
        alert(`${lang.value.alert_opening_url} ${gameName}...`);
        // window.api.openURL(activeGame.value.url);
    }
}

function importGame() {
    playSfx('confirm');
    const name = prompt(lang.value.prompt_import_name);
    if (name) {
        const newGame = {
            id: `local_${Date.now()}`,
            cn_name: name,
            en_name: name,
            type: 'local',
            img: "https://placehold.co/400x200/white/black?text=LOCAL+GAME"
        };
        userGames.value.push(newGame);
        conf.set('userGames', userGames.value);
    }
}

function confirmDelete() {
    if (activeGame.value && activeGame.value.type === 'local') {
        gameToDelete.value = activeGame.value;
        showConfirmDelete.value = true;
        playSfx('confirm');
    }
}

function performDelete() {
    playSfx('confirm');
    userGames.value = userGames.value.filter(g => g.id !== gameToDelete.value.id);
    conf.set('userGames', userGames.value);
    selectedIndex.value = 0;
    showConfirmDelete.value = false;
    gameToDelete.value = null;
}

function cancelDelete() {
    playSfx('cancel');
    showConfirmDelete.value = false;
    gameToDelete.value = null;
}

async function browseGamePath() {
    playSfx('confirm');
    const result = await window.api.openFile();
    if (result) {
        settingsForm.gamePath = result;
    }
}


function openSettings() {
    playSfx('confirm');
    settingsForm.downloadPath = settings.value.downloadPath;
    settingsForm.gamePath = settings.value.gamePath;
    // Reset other fields
    settingsForm.name = '';
    settingsForm.image = null;
    settingsForm.imageName = lang.value.settings_image_not_chosen;
    showSettings.value = true;
}

function saveSettings() {
    playSfx('confirm');
    settings.value.downloadPath = settingsForm.downloadPath;
    settings.value.gamePath = settingsForm.gamePath;
    conf.set('settings', settings.value);

    if (settingsForm.name) {
        // This part needs more robust handling for file paths in Electron
        const newGame = {
            id: `local_${Date.now()}`,
            cn_name: settingsForm.name,
            en_name: settingsForm.name,
            type: 'local',
            img: settingsForm.image ? URL.createObjectURL(settingsForm.image) : "https://placehold.co/400x200/white/black?text=LOCAL+GAME"
        };
        userGames.value.push(newGame);
        conf.set('userGames', userGames.value);
    }

    showSettings.value = false;
}

function cancelSettings() {
    playSfx('cancel');
    showSettings.value = false;
}

function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
        settingsForm.image = input.files[0];
        settingsForm.imageName = input.files[0].name;
    }
}


// --- Lifecycle ---
onMounted(async () => {
    initSfx();

    try {
        GITHUB_GAMES.value = [];
        userGames.value = (await conf.get('userGames', [])) as any[];
        settings.value = (await conf.get('settings', {'lang': 'en', 'downloadPath': '', 'backgroundImage': '', 'gamePath': ''})) as any;

    } catch (error) {
        console.error("Failed to load data on mount:", error);
    }

    // Periodically update game data
    setInterval(async () => {
        const res=await fetch('https://raw.githubusercontent.com/znm2500/UNDERTALE-AUs-Repo/main/game_index.json');
        if(res.ok){
            GITHUB_GAMES.value=await res.json();
        }
    }, 0); // Initial fetch
});

</script>

<template>
  <div class="top-bar">
    <input type="text" v-model="searchInput" class="search-input" :placeholder="lang.search" />
    <div class="lang-btn" @click="toggleLang">EN / 中文</div>
  </div>

  <div id="game-list">
    <div
      v-for="(game, index) in visibleList"
      :key="game.id"
      :class="['game-card', { selected: index === selectedIndex }]"
      @click="selectGame(index)"
    >
      <div class="card-left">
        <img :src="soulIcon" class="soul-icon" draggable="false" />
        <div class="info-box">
          <div class="name">{{ currentLang === 'en' ? (game.en_name) : (game.cn_name) }}</div>
          <div :class="['status', game.type === 'local' ? 'tag-installed' : 'tag-download']">
            {{ game.type === 'local' ? lang.installed : lang.to_download }}
          </div>
        </div>
      </div>
      <img :src="game.type === 'local' ? game.img : `https://raw.githubusercontent.com/znm2500/UNDERTALE-AUs-Repo/main/games/${game.id}/cover.webp`" class="card-cover" draggable="false" />
    </div>

    <div 
        v-if="visibleCount < filteredList.length" 
        class="load-more-btn" 
        @click="loadMore"
    >
        {{ lang.load_more }}
    </div>

    <div style="height: 20px; width: 100%; flex-shrink: 0;"></div>
  </div>

  <div class="footer">
    <div class="btn enabled" @click="importGame">{{ lang.import }}</div>
    <div class="btn enabled" @click="openSettings">{{ lang.settings }}</div>
    <div
      :class="['btn', { enabled: activeGame && activeGame.type === 'local', disabled: !activeGame || activeGame.type !== 'local' }]"
      @click="confirmDelete"
    >{{ lang.delete }}</div>
    <div
      :class="['btn', 'main', { enabled: activeGame, disabled: !activeGame }]"
      @click="handleAction"
    >
      {{ activeGame ? (activeGame.type === 'local' ? `${lang.play.replace(']','')} ${currentLang === 'en' ? activeGame.en_name : activeGame.cn_name} ]` : lang.download) : '[ --- ]' }}
    </div>
  </div>

  <div id="confirm-overlay" :class="{ show: showConfirmDelete }">
    <div class="confirm-card">
      <div class="confirm-body">{{ lang.confirm_del }} <span id="confirm-game-name">{{ currentLang === 'en' ? gameToDelete?.en_name : gameToDelete?.cn_name }}</span>?</div>
      <div class="confirm-actions">
        <div class="btn enabled" @click="performDelete">{{ lang.confirm_yes }}</div>
        <div class="btn" @click="cancelDelete">{{ lang.confirm_no }}</div>
      </div>
    </div>
  </div>

  <div id="settings-overlay" :class="{ show: showSettings }">
    <div class="settings-card">
      <div class="settings-title">{{ lang.settings_title }}</div>
      <div class="settings-body">
        <label>{{ lang.settings_import_name_label }}</label>
        <input type="text" v-model="settingsForm.name" class="search-input" :placeholder="lang.placeholder_game_name" />

        <label>{{ lang.settings_import_image_label }}</label>
        <div style="display:flex;gap:8px;align-items:center;">
          <label class="btn" for="setting-game-image-input" id="setting-choose-game-image">{{ lang.settings_choose_image }}</label>
          <div style="color:#ddd">{{ settingsForm.imageName }}</div>
        </div>
        <input type="file" id="setting-game-image-input" @change="handleFileSelect" accept="image/*" style="display:none" />

        <label>{{ lang.settings_download_path_label }}</label>
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="text" v-model="settingsForm.downloadPath" class="search-input" :placeholder="lang.placeholder_download_path" style="flex:1" />
          <div class="btn browse-btn">{{ lang.settings_browse }}</div>
        </div>

        <label>{{ lang.settings_game_path_label }}</label>
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="text" v-model="settingsForm.gamePath" class="search-input" :placeholder="lang.placeholder_download_path" style="flex:1" />
          <div class="btn browse-btn" @click="browseGamePath">{{ lang.settings_browse }}</div>
        </div>

      </div>
      <div class="settings-actions">
        <div class="btn enabled" @click="saveSettings">{{ lang.settings_save }}</div>
        <div class="btn" @click="cancelSettings" id="settings-cancel">{{ lang.settings_cancel }}</div>
      </div>
    </div>
  </div>
</template>

<style>
/* CSS from index.html will be pasted here, with adjustments */
@font-face {
    font-family: 'fzxs';
    src: url('./assets/fzxs.ttf') format('truetype');
}

:root {
    --bg-color: #000000;
    --border-color: #FFFFFF;
    --highlight-color: #FFFF00;
    --soul-color: #FF0000;
    --dim-text: #777777;
}

/* Styles that were on 'body' now apply to the root of the app or a wrapper */
#app {
    margin: 0; padding: 0;
    background: var(--bg-color);
    /* 背景 GIF（位于 src/assets）作为底层，叠加保留暗角的 radial-gradient */
    background-image: url('./assets/background.gif'), radial-gradient(circle, #1a002a 0%, #000 80%);
    background-size: cover, cover;
    background-repeat: no-repeat, no-repeat;
    background-position: center center, center center;
    font-family: 'fzxs', monospace;
    color: white;
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow: hidden;
    user-select: none;
}

/* The rest of the CSS... */
/* --- 顶部栏 --- */
.top-bar {
    max-width: 1200px; /* 限制顶部栏最大宽度，居中显示 */
    width: 75%;
    margin-top: 30px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.search-input {
    width: 60%;
    background: black;
    border: 5px solid white;
    color: white;
    font-family: 'fzxs', monospace;
    font-size: 1.4rem;
    padding: 5px 10px;
    outline: none;
}

.lang-btn {
    cursor: pointer;
    border: 5px solid white;
    padding: 2px 10px;
    font-size: 1.2rem;
}
.lang-btn:hover { background: white; color: black; }

/* --- 列表区域 --- */
#game-list {
    /* 列表居中，卡片宽度固定，窗口缩小时会出现滚动条 */
    width: 100%;
    max-width: 1200px;
    display: flex;
    flex-direction: column;
    align-items: center; /* 使固定宽度的卡片水平居中 */
    flex-grow: 1;
    margin: 20px 0;
    overflow-y: auto;
    padding-right: 15px;
}

.game-card {
    display: flex;
    border: 5px solid #333;
    margin: 0 0 20px 0;
    height: 260px;
    cursor: pointer;
    background: rgba(0,0,0,0.8);
    position: relative;
    width: 900px; /* 固定卡片宽度：不随窗口拉伸 */
    box-sizing: border-box;
    flex-shrink: 0; /* 防止被压缩 */
}

.game-card.selected {
    border: 5px solid white;
    box-shadow: 0 0 15px rgba(255, 255, 255, 0.3);
}

/* 左侧：心 + 信息 */
.card-left {
    flex: 1; /* 占据剩余空间 */
    display: flex;
    align-items: center;
    /* 保留左侧间距，缩小右侧间距以靠近分隔线 */
    padding: 0 5px 0 20px;
}

.soul-icon {
    width: 24px; height: 24px; /* Adjust size as needed */
    margin-right: 20px;
    opacity: 0;
    flex-shrink: 0;
    object-fit: contain; /* Ensure the image fits within the bounds */
}
.game-card.selected .soul-icon { opacity: 1; }

.info-box .name { font-size: 2.2rem; margin-bottom: 5px; }
.info-box .status { font-size: 1.1rem; letter-spacing: 1px; }
.tag-installed { color: #00FF00; }
.tag-download { color: #00A2E8; }

/* 右侧：超大图片 */
.card-cover {
    width: 45%; /* 图片占比显著增大 */
    height: 100%;
    object-fit: cover;
    border-left: 5px solid #333; /* 分隔线改为 5px */
    filter: grayscale(100%) brightness(0.6);
    flex-shrink: 0;
}

/* 窄屏降级：小于 940px 时让卡片适当收缩以避免水平滚动过多 */
@media (max-width: 940px) {
    .game-card {
        width: calc(100% - 40px); /* 留一些边距 */
        margin: 0 20px 20px 20px;
    }
    .card-cover { width: 40%; }
}
.game-card.selected .card-cover { filter: grayscale(0%) brightness(1); border-left-color: white; }

/* [新增] 加载更多按钮样式 */
.load-more-btn {
    color: var(--dim-text);
    font-size: 1.6rem;
    cursor: pointer;
    margin: 10px 0 20px 0;
    text-align: center;
    width: 100%;
    font-family: 'fzxs', monospace;
    transition: color 0.2s;
    user-select: none;
    flex-shrink: 0;
}

.load-more-btn:hover {
    color: var(--highlight-color);
}

/* --- 底部 --- */
.footer {
    width: 100%;
    padding: 15px 0;
    border-top: 5px solid white;
    display: flex;
    justify-content: center;
    gap: 60px;
    font-size: 1.6rem;
    background: black;
}

.btn { cursor: pointer; color: var(--dim-text); }
.btn:hover { color: var(--highlight-color); }
.btn.main { color: white; }
.btn.disabled { color: var(--dim-text); opacity: 0.6; pointer-events: none; cursor: default; }
.btn.disabled:hover { color: var(--dim-text); }
.btn.enabled { color: white; pointer-events: auto; }
.btn.enabled:hover { color: var(--highlight-color); }

/* 确认删除模态样式 */
#confirm-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.6);
    z-index: 9999;
    opacity: 0;
    pointer-events: none;
    transition: opacity 240ms ease;
}
#confirm-overlay.show {
    opacity: 1;
    pointer-events: auto;
}
.confirm-card {
    width: 520px;
    max-width: calc(100% - 40px);
    background: rgba(0,0,0,0.9);
    border: 5px solid white; /* 边框改为白色 */
    box-sizing: border-box;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    align-items: center;
}
.confirm-body { color: #fff; font-size: 1.4rem; }
.confirm-actions { display: flex; gap: 20px; }
.confirm-actions .btn { padding: 8px 18px; font-size: 1.4rem; color: white; }

/* Settings 模态样式 */
#settings-overlay {
    position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.6); z-index: 9999; opacity: 0; pointer-events: none; transition: opacity 240ms ease;
}
#settings-overlay.show { opacity: 1; pointer-events: auto; }
.settings-card {
    width: 680px; max-width: calc(100% - 40px); background: rgba(0,0,0,0.95);
    border: 5px solid #fff; box-sizing: border-box; padding: 18px; display:flex; flex-direction:column; gap:12px;
    font-size: 1.25rem; /* 卡片内文字调大 */
}
.settings-title { font-size: 1.9rem; color: white; margin-bottom:6px }
.settings-body { display:flex; flex-direction:column; gap:10px; color: white }
.settings-body label { color: #fff; font-size:1.1rem }
.settings-body input[type="text"] { padding:8px; background:black; border:5px solid white; color:white }
.settings-body input[type="file"] { color: white }
/* Ensure buttons inside settings are white by default */
.settings-card .btn { color: white }
/* 特定按钮在 hover 时变黄：选择图片、选择背景、取消 */
#setting-choose-game-image:hover,
#setting-choose-bg:hover,
#settings-cancel:hover,
.browse-btn:hover {
    color: var(--highlight-color);
}
.settings-actions { display:flex; gap:12px; justify-content:center; margin-top:8px }

/* Make search-input inside settings full-width */
.settings-body .search-input { width: 100%; box-sizing: border-box; }

/* --- 自定义滚动条：白色方形拇指，灰色方形轨道 --- */
/* 仅作用于 #game-list（Chromium/Electron + Firefox 基础支持） */
#game-list {
    /* Firefox */
    scrollbar-width: thin;
    scrollbar-color: #ffffff #000000; /* thumb track */
}

/* WebKit/Chromium */
#game-list::-webkit-scrollbar {
    width: 14px;
    height: 14px;
}
#game-list::-webkit-scrollbar-track {
    background: #000000; /* 灰色轨道 */
    border-radius: 0; /* 方形风格 */
}
#game-list::-webkit-scrollbar-thumb {
    background: #ffffff; /* 白色拇指 */
    border-radius: 0; /* 方形 */
    border: 2px solid #000000; /* 细边，增加可见性 */
    box-shadow: none;
}
#game-list::-webkit-scrollbar-thumb:hover {
    background: #f0f0f0;
}
#game-list::-webkit-scrollbar-corner {
    background: #ffffff;
}
</style>