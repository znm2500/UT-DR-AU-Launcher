<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch, toRaw } from 'vue'
import soulIcon from './assets/spr_soul.png'


const availableLanguages = [
    { code: 'en', label: 'English' },
    { code: 'zh', label: '中文' }
    // Add future languages here easily
];
// --- I18N ---
const I18N = {
    zh: {
        ok: "确定",
        search: "搜索AU...",
        import: "[ 导入 ]",
        delete: "[ 删除 ]",
        play: "[ 游玩 ]",
        download: "[ 前往下载 ]",
        installed: "已就绪",
        error: "错误",
        to_download: "未下载",
        downloading: "下载中",
        settings: "[ 设置 ]",
        settings_title: "设置",
        settings_lang_label: "语言",
        settings_import_name_label: "本地游戏名称",
        settings_import_image_label: "本地游戏图片",
        settings_bg_image_label: "启动器背景图片", // [新增]
        settings_choose_image: "选择图片",
        settings_image_not_chosen: "(未选择)",
        settings_image_current: "(当前背景)",
        settings_download_path_label: "游戏下载路径",
        settings_game_path_label: "游戏可执行文件路径",
        settings_browse: "浏览",
        settings_save: "保存",
        settings_cancel: "取消",
        confirm_del: "确定从列表中删除",
        confirm_yes: "是",
        confirm_no: "否",
        prompt_import_name: "游戏名称:",
        alert_launching: "启动中",
        alert_opening_url: "正在打开下载页面",
        placeholder_game_name: "游戏名称",
        placeholder_download_path: "/path/to/downloads",
        load_more: "↓ 加载更多"
    },
    en: {
        ok: "OK",
        search: "SEARCH AU...",
        import: "[ IMPORT ]",
        delete: "[ DELETE ]",
        play: "[ PLAY ]",
        download: "[ DOWNLOAD ]",
        installed: "INSTALLED",
        error: "ERROR",
        to_download: "DOWNLOADABLE",
        downloading: "DOWNLOADING",
        settings: "[ SETTINGS ]",
        settings_title: "Settings",
        settings_lang_label: "Language",
        settings_import_name_label: "Local Game Name",
        settings_import_image_label: "Local Game Image",
        settings_bg_image_label: "Launcher Background Image", // [新增]
        settings_choose_image: "Choose Image",
        settings_image_current: "(Current Background)",
        settings_image_not_chosen: "(Not chosen)",
        settings_download_path_label: "Game Download Path",
        settings_game_path_label: "Game Executable Path",
        settings_browse: "Browse",
        settings_save: "Save",
        settings_cancel: "Cancel",
        confirm_del: "Are you sure to delete ",
        confirm_yes: "Yes",
        confirm_no: "No",
        prompt_import_name: "Game Name:",
        alert_launching: "Launching",
        alert_opening_url: "Opening download page for",
        placeholder_game_name: "Game name",
        placeholder_download_path: "/path/to/downloads",
        load_more: "↓ SHOW MORE"
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
const force_render_key = ref(0);
const searchInput = ref('');
const GITHUB_GAMES = ref<any[]>([]);
const userGames = ref<any[]>([]);
const settings = ref({
    downloadPath: '',
    backgroundImage: '', // 这里存储图片的 DataURL 或路径
    lang: 'en',
    gamePath: ''
});

const currentLang = computed(() => settings.value.lang);
const selectedIndex = ref(0);
const visibleCount = ref(5);
const downloadIdSet = new Set();
const showConfirmDelete = ref(false);

const showSettings = ref(false);
const settingsForm = reactive({
    name: '',
    image: null as File | null,
    imageName: computed(() => (I18N[currentLang.value] || I18N.en).settings_image_not_chosen),
    bgImage: null as File | null, // [新增]
    bgImageName: '', // [新增]
    downloadPath: '',
    gamePath: '',
    lang: 'en'
});


// --- Computed Properties ---
const lang = computed(() => I18N[currentLang.value] || I18N.en);
function forceRender() {
    force_render_key.value++;
}

// 动态背景样式 [新增]
const appBackgroundStyle = computed(() => {
    if (settings.value.backgroundImage) {
        return { backgroundImage: `url(${settings.value.backgroundImage})` };
    }
    return {}; // 默认使用 CSS 里的 background.gif
});

const fullList = computed(() => {
    const gameMap = new Map();
    userGames.value.forEach(g => gameMap.set(g.id, g));
    GITHUB_GAMES.value.forEach(g => {
        if (!gameMap.has(g.id)) {
            g.type = downloadIdSet.has(g.id) ? 'downloading' : 'remote';
            g.playable = false;
            g.img = `https://cdn.jsdelivr.net/gh/znm2500/AU-Launcher-Repo@data/${g.id}.webp`;
            g.execution_path = '';
            gameMap.set(g.id, g);
        }
    });
    return Array.from(gameMap.values());
});

const filteredList = computed(() => {
    const query = searchInput.value.toLowerCase();
    if (!query) return fullList.value;
    return fullList.value.filter(g =>
    (g.en_name?.toLowerCase().includes(query) ||
        g.zh_name?.toLowerCase().includes(query))
    );
});

const visibleList = computed(() => {
    return filteredList.value.slice(0, visibleCount.value);
});

const activeGame = computed(() => filteredList.value[selectedIndex.value] || null);

// --- Methods ---

function selectGame(index: number) {
    playSfx('switch');
    selectedIndex.value = index;
}

const showErrorModal = ref(false);
const errorMessage = ref('');
function browseDownloadPath() {
    playSfx('confirm');
    (async () => {

        const result = await window.api.openFolder();

        if (result) {

            settingsForm.downloadPath = result;
        }
    })();
}
function triggerError(msg: string) {
    playSfx('cancel');
    errorMessage.value = msg;
    showErrorModal.value = true;
}

function closeError() {
    playSfx('switch');
    showErrorModal.value = false;
}

function loadMore() {
    playSfx('confirm');
    visibleCount.value += 5;
}

watch(searchInput, () => {
    visibleCount.value = 5;
    selectedIndex.value = 0;
});

function handleAction() {
    if ((!activeGame.value) || (activeGame.value.type === 'local' && !activeGame.value.playable) || (activeGame.value.type === 'downloading')) return;
    playSfx('confirm');
    (async () => {
        if (activeGame.value.type === 'local') {
            try {
                await window.api.launchGame(activeGame.value.execution_path);

            } catch (err: any) {
                triggerError(`${err}`);
                activeGame.value.playable = false;
                await window.api.setStoreValue('userGames', JSON.parse(JSON.stringify(userGames.value)));
            }
        } else if (activeGame.value.type === 'remote') {
            activeGame.value.type = 'downloading';
            forceRender();
            downloadIdSet.add(activeGame.value.id);
            try {
                let game_temp = activeGame.value;
                await window.api.downloadGame(`https://github.com/znm2500/AU-Launcher-Repo/releases/download/v${game_temp.version}/${game_temp.id}.7z`, `${settings.value.downloadPath}/${game_temp.id}`, `${game_temp.id}.7z`);
                game_temp.type = 'local';
                game_temp.playable = true;
                game_temp.execution_path = `${settings.value.downloadPath}/${game_temp.id}/game.exe`;
                delete game_temp.version;
                userGames.value.push(game_temp);
                downloadIdSet.delete(game_temp.id);
                await window.api.setStoreValue('userGames', JSON.parse(JSON.stringify(userGames.value)));
            } catch (err: any) {
                triggerError(`${err}`);
                activeGame.value.type = 'remote';
                downloadIdSet.delete(activeGame.value.id);
                forceRender();
            }
        }
    }
    )();
}

function importGame() {
    playSfx('confirm');
    const name = prompt(lang.value.prompt_import_name, lang.value.placeholder_game_name);
    if (name) {
        const newGame = {
            id: `local_${Date.now()}`,
            zh_name: name,
            en_name: name,
            type: 'local',
            playable: true,
            img: "https://placehold.co/400x200/white/black?text=LOCAL+GAME",
            execution_path: ''
        };
        userGames.value.push(newGame);
        (async () => {
            await window.api.setStoreValue('userGames', JSON.parse(JSON.stringify(userGames.value)));
        })();
    }
}

function confirmDelete() {
    if (activeGame.value && activeGame.value.type === 'local') {
        showConfirmDelete.value = true;
        playSfx('confirm');
    }
}

function performDelete() {
    playSfx('confirm');
    let execution_path;
    userGames.value = userGames.value.filter((g) => {
        if(g.id === activeGame.value.id) {
            execution_path = g.execution_path;
            return false;
        }
        return true;
    });
    selectedIndex.value = 0;
    showConfirmDelete.value = false;
    (async () => {
        await window.api.deleteFolder(execution_path.split('/').slice(0, -1).join('/'));
        await window.api.setStoreValue('userGames', JSON.parse(JSON.stringify(userGames.value)));
    })();
}

function cancelDelete() {
    playSfx('cancel');
    showConfirmDelete.value = false;
}

function browseGamePath() {
    playSfx('confirm');
    (async () => {
        const result = await window.api.openFile();
        if (result) {
            settingsForm.gamePath = result;
        }
    })();
}


function openSettings() {
    playSfx('confirm');

    // --- 核心修改：将当前生效的 settings 同步到表单中 ---
    settingsForm.downloadPath = settings.value.downloadPath;
    settingsForm.lang = settings.value.lang;

    // 如果当前有选中的本地游戏，加载它的路径和名称
    if (activeGame.value && activeGame.value.type === 'local') {

        switch (currentLang.value) {
            case 'en':
                settingsForm.name = activeGame.value.en_name;
                break;
            case 'zh':
            default:
                settingsForm.name = activeGame.value.zh_name;
                break;
        }
        settingsForm.gamePath = activeGame.value.execution_path; // 填入当前执行路径
    } else {
        settingsForm.name = '';
        settingsForm.gamePath = '';
    }

    // 背景图逻辑
    settingsForm.bgImage = null; // 重置新选择的文件对象
    settingsForm.bgImageName = settings.value.backgroundImage
        ? lang.value.settings_image_current
        : lang.value.settings_image_not_chosen;

    showSettings.value = true;
}
function saveSettings() {
    playSfx('confirm');

    // 1. 同步非图片数据
    settings.value.downloadPath = settingsForm.downloadPath;
    settings.value.lang = settingsForm.lang;
    if (activeGame.value && activeGame.value.type === 'local') {
        if (activeGame.value.execution_path !== settingsForm.gamePath) {
            activeGame.value.playable = true;
            activeGame.value.execution_path = settingsForm.gamePath;
        }
        switch (settingsForm.lang) {
            case 'en':
                activeGame.value.en_name = settingsForm.name;
                break;
            case 'zh':
                activeGame.value.zh_name = settingsForm.name;
                break;
        }
        
        if (settingsForm.image) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                activeGame.value.img = e.target?.result as string;
                // 确保图片转码完成后再执行持久化
                await window.api.setStoreValue('userGames', JSON.parse(JSON.stringify(userGames.value)));
            };
            reader.readAsDataURL(settingsForm.image);
        } else {
            // 如果没有新图片，直接保存
            (async () => {
                await window.api.setStoreValue('userGames', JSON.parse(JSON.stringify(userGames.value)));
            })();
        }
    }
    showSettings.value = false;
    // 2. 处理图片异步保存
    if (settingsForm.bgImage) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            settings.value.backgroundImage = e.target?.result as string;
            // 确保图片转码完成后再执行持久化
            await window.api.setStoreValue('settings', toRaw(settings.value));

        };
        reader.readAsDataURL(settingsForm.bgImage);
    } else {
        // 如果没有新图片，直接保存
        (async () => {
            await window.api.setStoreValue('settings', toRaw(settings.value));
        })();
    }
}

function cancelSettings() {
    playSfx('cancel');
    showSettings.value = false;
}

function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
        settingsForm.image = input.files[0];
    }
}

// [新增] 处理背景图片选择
function handleBgFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
        settingsForm.bgImage = input.files[0];
        settingsForm.bgImageName = input.files[0].name;
    }
}


// --- Lifecycle ---
onMounted(async () => {
    initSfx();

    try {
        GITHUB_GAMES.value = [];

        userGames.value = (await window.api.getStoreValue('userGames', [])) as any[];
        const downloadPath = await window.api.getdownloadpath();
        settings.value = (await window.api.getStoreValue('settings', { 'lang': 'en', 'downloadPath': downloadPath, 'backgroundImage': '' })) as any;

    } catch (error) {
        console.error("Failed to load data on mount:", error);
    }

    (async () => {
        try {
            //  const res = await fetch('https://cdn.jsdelivr.net/gh/znm2500/AU-Launcher-Repo@data/game_index.json');
            const res = await fetch('https://raw.githubusercontent.com/znm2500/AU-Launcher-Repo/data/game_index.json');
            if (res.ok) {
                GITHUB_GAMES.value = await res.json();
            }
        } catch (error) {
            console.error('Failed to refresh game list:', error);
        }
    })();
});

</script>

<template>
    <div id="app" :style="appBackgroundStyle">
        <div class="top-bar">
            <input type="text" v-model="searchInput" class="search-input" :placeholder="lang.search" />
        </div>

        <div id="game-list">
            <div v-for="(game, index) in visibleList" :key="game.id"
                :class="['game-card', { selected: index === selectedIndex }]" @click="selectGame(index)">
                <div class="card-left">
                    <img :src="soulIcon" class="soul-icon" draggable="false" />
                    <div class="info-box">
                        <div class="name">{{ currentLang === 'en' ? (game.en_name) : (game.zh_name) }}</div>
                        <div :key="force_render_key"
                            :class="['status', game.type === 'local' ? (game.playable ? 'tag-installed' : 'tag-error') : (game.type === 'downloading' ? 'tag-downloading' : 'tag-download')]">
                            {{ game.type === 'local' ? (game.playable ? lang.installed : lang.error) :
                                (game.type === "downloading" ? lang.downloading : lang.to_download) }}
                        </div>
                    </div>
                </div>
                <img :src="game.img" class="card-cover" draggable="false" />
            </div>

            <div v-if="visibleCount < filteredList.length" class="load-more-btn" @click="loadMore">
                {{ lang.load_more }}
            </div>
            <div style="height: 20px; width: 100%; flex-shrink: 0;"></div>
        </div>

        <div class="footer">
            <div class="btn enabled" @click="importGame">{{ lang.import }}</div>
            <div class="btn enabled" @click="openSettings">{{ lang.settings }}</div>
            <div :class="['btn', { enabled: activeGame && activeGame.type === 'local', disabled: !activeGame || activeGame.type !== 'local' }]"
                @click="confirmDelete">{{ lang.delete }}</div>
            <div :class="['btn', 'main', {
                enabled: activeGame,
                disabled: !activeGame,
                downloading: activeGame?.type === 'downloading' // [新增] 添加这个类名
            }]" @click="handleAction">
                {{ activeGame ? (activeGame.type === 'local' ? (activeGame.playable ? lang.play : '[ --- ]') :
                    activeGame.type === 'downloading' ? `[
                ${lang.downloading} ]` : lang.download) : '[ --- ]' }}
            </div>
        </div>

        <div id="confirm-overlay" :class="{ show: showConfirmDelete }">
            <div class="confirm-card">
                <div class="confirm-body">{{ lang.confirm_del }} <span id="confirm-game-name">{{ currentLang === 'en' ?
                    activeGame?.en_name : activeGame?.zh_name }}</span>?</div>
                <div class="confirm-actions">
                    <div class="btn enabled" @click="performDelete">{{ lang.confirm_yes }}</div>
                    <div class="btn" @click="cancelDelete">{{ lang.confirm_no }}</div>
                </div>
            </div>
        </div>

        <div id="settings-overlay" :class="{ show: showSettings }">
            <div class="settings-card">
                <div class="settings-title">{{ lang.settings_title }}</div>
                <div class="settings-body scrollable-settings">

                    <label>{{ lang.settings_lang_label }}</label>

                    <select v-model="settingsForm.lang" class="retro-select">
                        <option v-for="opt in availableLanguages" :key="opt.code" :value="opt.code">
                            {{ opt.label }}
                        </option>
                    </select>


                    <label>{{ lang.settings_bg_image_label }}</label>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <label class="btn" for="setting-bg-image-input" id="setting-choose-bg-image">{{
                            lang.settings_choose_image
                        }}</label>
                        <div style="color:#ddd; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis;">{{
                            settingsForm.bgImageName
                        }}</div>
                    </div>
                    <input type="file" id="setting-bg-image-input" @change="handleBgFileSelect"
                        accept=".jpg,.jpeg,.png,.webp,.gif" style="display:none" />

                    <label>{{ lang.settings_download_path_label }}</label>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <input type="text" v-model="settingsForm.downloadPath" class="search-input"
                            :placeholder="lang.placeholder_download_path" style="flex:1" />
                        <div class="btn browse-btn" @click="browseDownloadPath">{{ lang.settings_browse }}</div>
                    </div>
                    <template v-if="activeGame?.type === 'local'">
                        <label>{{ lang.settings_import_name_label }}</label>
                        <input type="text" v-model="settingsForm.name" class="search-input"
                            :placeholder="lang.placeholder_game_name" />

                        <label>{{ lang.settings_import_image_label }}</label>
                        <div style="display:flex;gap:8px;align-items:center;">
                            <label class="btn" for="setting-game-image-input" id="setting-choose-game-image">{{
                                lang.settings_choose_image }}</label>
                            <div style="color:#ddd; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis;">{{
                                settingsForm.imageName }}</div>
                        </div>
                        <input type="file" id="setting-game-image-input" @change="handleFileSelect"
                            accept=".jpg,.jpeg,.png,.webp,.gif" style="display:none" />
                        <label>{{ lang.settings_game_path_label }}</label>
                        <div style="display:flex;gap:8px;align-items:center;">
                            <input type="text" v-model="settingsForm.gamePath" class="search-input"
                                :placeholder="lang.placeholder_download_path" style="flex:1" />
                            <div class="btn browse-btn" @click="browseGamePath">{{ lang.settings_browse }}</div>
                        </div>
                    </template>
                </div>
                <div class="settings-actions">
                    <div class="btn enabled" @click="saveSettings">{{ lang.settings_save }}</div>
                    <div class="btn" @click="cancelSettings" id="settings-cancel">{{ lang.settings_cancel }}</div>
                </div>
            </div>
        </div>

        <div id="error-overlay" :class="{ show: showErrorModal }">
            <div class="error-card">
                <div class="error-header">
                    <span class="error-title">{{ lang.error }}</span>
                </div>
                <div class="error-body">
                    {{ errorMessage }}
                </div>
                <div class="error-actions">
                    <div class="btn main enabled" @click="closeError">{{ lang.ok }}</div>
                </div>
            </div>
        </div>
    </div>
</template>

<style>
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

#app {
    margin: 0;
    padding: 0;
    background: var(--bg-color);
    background-image: url("./assets/background.gif");
    background-size: cover;
    background-repeat: no-repeat;
    background-position: center center;
    font-family: 'fzxs', monospace;
    color: white;
    height: 100vh;
    width: 100vw;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow: hidden;
    user-select: none;
    transition: background-image 0.5s ease-in-out;
    /* 背景切换平滑一点 */
}

/* --- 顶部栏 --- */
.top-bar {
    max-width: 1200px;
    width: 75%;
    margin-top: 30px;
    display: flex;
    justify-content: center;
    /* Changed from space-between to center */
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
    text-align: center;
    /* Optional: Centers text inside the box too, consistent with retro RPGs */
}

.lang-btn {
    cursor: pointer;
    border: 5px solid white;
    padding: 2px 10px;
    font-size: 1.2rem;
}

.lang-btn:hover {
    background: white;
    color: black;
}

/* --- 列表区域 --- */
#game-list {
    width: 100%;
    max-width: 1200px;
    display: flex;
    flex-direction: column;
    align-items: center;
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
    background: rgba(0, 0, 0, 0.8);
    position: relative;
    width: 900px;
    box-sizing: border-box;
    flex-shrink: 0;
}

.game-card.selected {
    border: 5px solid white;
    box-shadow: 0 0 15px rgba(255, 255, 255, 0.3);
}

.card-left {
    flex: 1;
    display: flex;
    align-items: center;
    padding: 0 5px 0 20px;
}

.soul-icon {
    width: 24px;
    height: 24px;
    margin-right: 20px;
    opacity: 0;
    flex-shrink: 0;
    object-fit: contain;
}

.game-card.selected .soul-icon {
    opacity: 1;
}

.info-box .name {
    font-size: 2.2rem;
    margin-bottom: 5px;
}

.info-box .status {
    font-size: 1.1rem;
    letter-spacing: 1px;
}

.tag-installed {
    color: #00FF00;
}

.tag-download {
    color: #00A2E8;
}

.tag-error {
    color: #FF0000;
}

.tag-downloading {
    color: #FFA500;
}

.card-cover {
    width: 45%;
    height: 100%;
    object-fit: cover;
    border-left: 5px solid #333;
    filter: grayscale(100%) brightness(0.6);
    flex-shrink: 0;
}

@media (max-width: 940px) {
    .game-card {
        width: calc(100% - 40px);
        margin: 0 20px 20px 20px;
    }

    .card-cover {
        width: 40%;
    }
}

.game-card.selected .card-cover {
    filter: grayscale(0%) brightness(1);
    border-left-color: white;
}

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

.btn {
    cursor: pointer;
    color: var(--dim-text);
}

.btn:hover {
    color: var(--highlight-color);
}

.btn.main {
    color: white;
}

.btn.disabled {
    color: var(--dim-text);
    opacity: 0.6;
    pointer-events: none;
    cursor: default;
}

.btn.disabled:hover {
    color: var(--dim-text);
}

.btn.enabled {
    color: white;
    pointer-events: auto;
}

.btn.enabled:hover {
    color: var(--highlight-color);
}

.btn.downloading {
    color: #fff !important;
    /* 下载中显示橙色，且强制不被 hover 覆盖 */
    cursor: default;
    pointer-events: none;
    /* 关键：禁用所有鼠标事件，包括 hover 效果和点击 */
    opacity: 0.8;
}

.btn:hover:not(.downloading) {
    color: var(--highlight-color);
}

.retro-select {
    width: 100%;
    background: black;
    color: white;
    font-family: 'fzxs', monospace;
    font-size: 1.2rem;
    border: 5px solid white;
    padding: 5px 10px;
    outline: none;
    cursor: pointer;
    appearance: none;
    /* Removes default OS arrow */
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23FFFFFF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E");
    background-repeat: no-repeat;
    background-position: right 10px top 50%;
    background-size: 12px auto;
}

.retro-select:hover {
    background-color: #222;
    /* Slight highlight on hover */
}

.retro-select option {
    background: black;
    color: white;
    padding: 10px;
}

/* 模态框通用样式 */
#confirm-overlay,
#settings-overlay,
#error-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.8);
    z-index: 9999;
    opacity: 0;
    pointer-events: none;
    transition: opacity 240ms ease;
}

#confirm-overlay.show,
#settings-overlay.show,
#error-overlay.show {
    opacity: 1;
    pointer-events: auto;
}

.confirm-card,
.settings-card,
.error-card {
    background: rgba(0, 0, 0, 0.95);
    border: 5px solid white;
    padding: 20px;
    box-sizing: border-box;
}

.settings-card {
    width: 680px;
    max-width: calc(100% - 40px);
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.scrollable-settings {
    max-height: 60vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-right: 10px;
}

/* 滚动条样式 */
#game-list::-webkit-scrollbar,
.scrollable-settings::-webkit-scrollbar {
    width: 10px;
}

#game-list::-webkit-scrollbar-track,
.scrollable-settings::-webkit-scrollbar-track {
    background: #000;
}

#game-list::-webkit-scrollbar-thumb,
.scrollable-settings::-webkit-scrollbar-thumb {
    background: #fff;
}

.settings-title {
    font-size: 1.9rem;
    color: white;
    margin-bottom: 6px
}

.settings-body label {
    color: #fff;
    font-size: 1.1rem;
    margin-top: 5px;
}

.settings-actions {
    display: flex;
    gap: 20px;
    justify-content: center;
    margin-top: 15px
}

.error-title {
    font-size: 1.8rem;
    color: #FF0000;
}

.error-body {
    font-size: 1.3rem;
    min-height: 60px;
    word-break: break-all;
}

/* 错误弹窗按钮样式 */
.error-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 20px;
}

.error-actions .btn {
    font-size: 1.6rem;
    padding: 10px 25px;
}

input[type="radio"] {
    margin-right: 5px;
}
</style>