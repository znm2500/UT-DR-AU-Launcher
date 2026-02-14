<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue'
import soulIcon from './assets/spr_soul.png'
import defaultCover from './assets/default_cover.webp'
import path from 'path-browserify';
import confirmWav from './assets/sfx/confirm.wav'
import cancelWav from './assets/sfx/cancel.wav'
import switchWav from './assets/sfx/switch.wav'
import saveWav from './assets/sfx/save.wav'

const availableLanguages = [
    { code: 'en', label: 'English' },
    { code: 'zh', label: '中文' }
];

// --- I18N (保持不变) ---
const I18N = {
    zh: {
        ok: "确定",
        search: "搜索AU...",
        import: "[ 导入 ]",
        export: "[ 导出 ]",
        delete: "[ 删除 ]",
        play: "[ 游玩 ]",
        download: "[ 前往下载 ]",
        installed: "已就绪",
        error: "错误",
        export_select_all: "[ 全选 / 取消全选 ]",
        to_download: "未下载",
        downloading: "下载中",
        settings: "[ 设置 ]",
        settings_title: "设置",
        settings_lang_label: "语言",
        settings_import_name_label: "本地游戏名称",
        settings_import_image_label: "本地游戏图片",
        settings_bg_image_label: "启动器背景图片",
        settings_choose_image: "选择图片",
        settings_image_not_chosen: "(未选择)",
        settings_image_current: "(当前图片)",
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
        load_more: "↓ 加载更多",
        name_exe: "执行程序",
        name_aup: "同人包",
        export_title: "导出游戏 (.aup)",
        export_select_label: "请选择要导出的游戏 (可多选):",
        export_confirm: "导出选中项",
        exporting: "正在导出...",
        importing: "正在导入...",
        export_success: "所有导出任务已完成!",
        success: "成功",
        import_title: "导入游戏",
        import_method_exe: "> 导入本地执行程序 (.exe)",
        import_method_aup: "> 导入同人包 (.aup)",
        import_aup_select_label: "请选择要从包中导入的游戏:",
        import_aup_confirm: "开始导入",
        select_export_dir: "请选择导出文件的保存目录",
        import_success: "导入成功!",
        update_title: "版本更新",
        update_msg: "检测到新版本: ",
        update_ignore: "[ 再也不显示 ]",
        update_download: "[ 前往下载 ]",
        network_disconnected: "网络已断开!",
        parsing_title: "解析中...",
        parsing_msg: "正在解压资源，请稍候...",
        settings_import_author_label: "作者",
        settings_import_engine_label: "引擎",
        placeholder_author: "游戏作者名称",
        playing: "游玩中",
        placeholder_engine: "游戏制作引擎"
    },
    en: {
        ok: "OK",
        search: "SEARCH AU...",
        import: "[ IMPORT ]",
        export: "[ EXPORT ]",
        delete: "[ DELETE ]",
        play: "[ PLAY ]",
        download: "[ DOWNLOAD ]",
        installed: "INSTALLED",
        error: "ERROR",
        export_select_all: "[ SELECT / DESELECT ALL ]",
        to_download: "DOWNLOADABLE",
        downloading: "DOWNLOADING",
        settings: "[ SETTINGS ]",
        settings_title: "Settings",
        settings_lang_label: "Language",
        settings_import_name_label: "Local Game Name",
        settings_import_image_label: "Local Game Image",
        settings_bg_image_label: "Launcher Background Image",
        settings_choose_image: "Choose Image",
        settings_image_current: "(Current Image)",
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
        load_more: "↓ SHOW MORE",
        name_exe: "Execution File",
        name_aup: "Another Universe Package",
        export_title: "Export Game (.aup)",
        export_select_label: "Select games to export (Multi-select):",
        export_confirm: "Export Selected",
        exporting: "Exporting...",
        importing: "Importing...",
        export_success: "All exports finished!",
        success: "Success",
        import_title: "IMPORT GAME",
        import_method_exe: "> IMPORT LOCAL EXE (.exe)",
        import_method_aup: "> IMPORT PACKAGE (.aup)",
        import_aup_select_label: "Select games to import from package:",
        import_aup_confirm: "IMPORT SELECTED",
        select_export_dir: "Select directory to save files",
        update_title: "UPDATE",
        update_msg: "New version available: ",
        update_ignore: "[ DO NOT SHOW AGAIN ]",
        update_download: "[ DOWNLOAD ]",
        import_success: "Import successful!",
        network_disconnected: "Network disconnected!",
        parsing_title: "PARSING...",
        settings_import_author_label: "Author",
        settings_import_engine_label: "Engine",
        placeholder_author: "Game author name",
        placeholder_engine: "Game engine",
        playing: "PLAYING",
        parsing_msg: "Extracting resources, please wait..."
    }
};

// --- SFX (保持不变) ---
const sfx: { [key: string]: HTMLAudioElement } = {};
function initSfx() {
    const SFX_MAP = {
        confirm: confirmWav,
        cancel: cancelWav,
        switch: switchWav,
        save: saveWav
    };
    try {
        for (const [key, path] of Object.entries(SFX_MAP)) {
            const aud = new Audio(path);
            aud.preload = 'auto';
            sfx[key] = aud;
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

// --- Utils: 优化文件读取 ---
// 将 FileReader 封装为 Promise，方便使用 await 并行处理
function readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string || '');
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
    });
}



// --- Reactive State ---
const force_render_key = ref(0);
const searchInput = ref('');
const GITHUB_GAMES = ref<any[]>([]);
const userGames = ref<any[]>([]);
const currentVersion = '1.0.0';
const latestVersion = ref('');
const updateLog = ref<Record<string, string>>({});
const settings = ref({
    downloadPath: '',
    backgroundImage: '',
    lang: 'en',
    ignoredVersion: ''
});
const showUpdateModal = ref(false);
const showExeImportModal = ref(false);
const exeImportForm = reactive({
    name: '',
    path: '',
    author: '',
    engine: '',
    image: null as File | null,
    imageName: ''
});
const currentLang = computed(() => settings.value.lang);
const selectedIndex = ref(0);
const visibleCount = ref(5);
const downloadIdSet = new Set();
const showConfirmDelete = ref(false);
const isParsingAup = ref(false);
const showSettings = ref(false);
const settingsForm = reactive({
    name: '',
    author: '',
    engine: '',
    image: null as File | null,
    imageName: '',
    bgImage: null as File | null,
    bgImageName: '',
    downloadPath: '',
    gamePath: '',
    lang: 'en'
});
const isImporting = ref(false);
// 导出相关状态
const zipProgress = ref(0);
const showExportModal = ref(false);
const selectedExportIds = ref<Set<string>>(new Set());
const isExporting = ref(false);
const errorTitle = ref('');
const showImportTypeModal = ref(false);
const showAupImportModal = ref(false);
const aupPendingGames = ref<any[]>([]);
const selectedAupIds = ref<Set<string>>(new Set());
const tmpAupDir = ref('');
const isChinaIP = ref(false);
const errorMessage = ref('');
const showErrorModal = ref(false);
const downloadProgress = reactive<{ [key: string]: number }>({});

// --- Computed Properties ---
const lang = computed(() => I18N[currentLang.value] || I18N.en);
function forceRender() {
    force_render_key.value++;
}

const appBackgroundStyle = computed(() => {
    if (settings.value.backgroundImage) {
        return { backgroundImage: `url(${settings.value.backgroundImage})` };
    }
    return {};
});

// 优化：fullList 计算属性
// 这里本身逻辑不复杂，但为了避免频繁重建 Set，逻辑保持清晰即可
const fullList = computed(() => {
    const gameMap = new Map();
    // 先添加本地游戏
    userGames.value.forEach(g => gameMap.set(g.id, g));

    // 只有当 GITHUB_GAMES 有数据时才处理
    if (GITHUB_GAMES.value.length > 0) {


        GITHUB_GAMES.value.forEach(g => {
            if (!gameMap.has(g.id)) {
                g.type = downloadIdSet.has(g.id) ? 'downloading' : 'remote';
                g.playable = false;
                // 只有在需要显示时才拼接字符串
                g.img = `https://cdn.jsdelivr.net/gh/znm2500/AU-Launcher-Repo@data/${g.id}.webp`;
                g.execution_path = '';
                gameMap.set(g.id, g);
            }
        });
    }
    return Array.from(gameMap.values());
});

const filteredList = computed(() => {
    const query = searchInput.value.toLowerCase();
    if (!query.trim()) return fullList.value;

    return fullList.value.filter(g => {
        // 1. 匹配名称 (多语言)
        if (g.name && typeof g.name === 'object') {
            if (g.name.zh?.toLowerCase().includes(query) || g.name.en?.toLowerCase().includes(query)) return true;
        }

        // 2. 匹配作者 (Author)
        if (g.author && g.author.toLowerCase().includes(query)) return true;

        // 3. 匹配引擎 (Engine)
        if (g.engine && g.engine.toLowerCase().includes(query)) return true;

        // 4. 原有的兜底逻辑 (遍历其他字符串字段)
        for (const k of Object.keys(g)) {
            if (k === 'img' || k === 'desc' || k === 'name' || k === 'author' || k === 'engine') continue;
            if (typeof g[k] === 'string' && g[k].toLowerCase().includes(query)) return true;
        }

        return false;
    });
});

const visibleList = computed(() => {
    return filteredList.value.slice(0, visibleCount.value);
});

const activeGame = computed(() => filteredList.value[selectedIndex.value] || null);

const localUserGames = computed(() => {
    return userGames.value.filter(g => g.type === 'local');
});
const isAllSelected = computed(() => {
    return localUserGames.value.length > 0 && selectedExportIds.value.size === localUserGames.value.length;
});

// --- Methods ---

function selectGame(index: number) {
    playSfx('switch');
    selectedIndex.value = index;
}

function goToDownload() {
    playSfx('confirm');
    window.api.openExternal(isChinaIP.value ? 'https://gitcode.com/znm1145/UT-DR-AU-Launcher/releases' : 'https://github.com/znm2500/UT-DR-AU-Launcher/releases');
    showUpdateModal.value = false;
}

async function ignoreVersion() {
    playSfx('cancel');
    settings.value.ignoredVersion = latestVersion.value;
    // 使用 JSON.parse(JSON.stringify 优化
    await window.api.setStoreValue('settings', JSON.parse(JSON.stringify(settings.value)));
    showUpdateModal.value = false;
}

function browseDownloadPath() {
    playSfx('confirm');
    (async () => {
        const result = await window.api.openFolder();
        if (result) {
            settingsForm.downloadPath = result;
        }
    })();
}

function triggerDialog(msg: string, title: string, sfx: string = 'error') {
    playSfx(sfx);
    errorTitle.value = title;
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

async function handleAction() {
    if ((!activeGame.value) || (activeGame.value.type === 'local' && !activeGame.value.playable) || (activeGame.value.type === 'downloading') || (activeGame.value.type === 'playing')) return;

    playSfx('confirm');

    if (activeGame.value.type === 'local') {
        try {
            const gameId = activeGame.value.id;
            const indexInUserGames = userGames.value.findIndex(g => g.id === gameId);
            const game = activeGame.value;
            const originalType = game.type;
            if (indexInUserGames !== -1) {
                const [movedGame] = userGames.value.splice(indexInUserGames, 1);
                userGames.value.unshift(movedGame);
                window.api.setStoreValue('userGames', JSON.parse(JSON.stringify(userGames.value))).catch(console.error);
                selectedIndex.value = 0;
            }
            game.type = 'playing';
            forceRender();
            await window.api.launchGame(game.execution_path);
            game.type = originalType;
            forceRender();
          
        } catch (err: any) {
            triggerDialog(`${err}`, lang.value.error);
            activeGame.value.playable = false;
            window.api.setStoreValue('userGames', JSON.parse(JSON.stringify(userGames.value)));
        }
    } else if (activeGame.value.type === 'remote') {
        if (!navigator.onLine) {
            triggerDialog(lang.value.network_disconnected, lang.value.error);

            return;
        }
        const game_temp = activeGame.value;
        game_temp.type = 'downloading';
        downloadIdSet.add(game_temp.id);
        downloadProgress[game_temp.id] = 0;
        forceRender();

        try {
            const url = isChinaIP.value
                ? `https://gitcode.com/znm1145/AU-Launcher-Repo/releases/download/v${game_temp.version}/${game_temp.id}.7z`
                : `https://github.com/znm2500/AU-Launcher-Repo/releases/download/v${game_temp.version}/${game_temp.id}.7z`;

            await window.api.downloadGame(
                url,
                `${settings.value.downloadPath}/${game_temp.id}`,
                `${game_temp.id}.7z`,
                game_temp.id
            );

            game_temp.type = 'local';
            game_temp.playable = true;
            game_temp.execution_path = `${settings.value.downloadPath}/${game_temp.id}/game.exe`;
            if (game_temp.version) delete game_temp.version;

            const existingIndex = userGames.value.findIndex(g => g.id === game_temp.id);
            if (existingIndex !== -1) {
                userGames.value.splice(existingIndex, 1);
            }
            // 使用深拷贝断开引用
            userGames.value.unshift(JSON.parse(JSON.stringify(game_temp)));

            downloadIdSet.delete(game_temp.id);
            delete downloadProgress[game_temp.id];

            // 优化保存
            await window.api.setStoreValue('userGames', JSON.parse(JSON.stringify(userGames.value)));

            selectedIndex.value = 0;
            forceRender();

        } catch (err: any) {
            triggerDialog(`${err}`, lang.value.error);
            game_temp.type = 'remote';
            downloadIdSet.delete(game_temp.id);
            delete downloadProgress[game_temp.id];
            forceRender();
        }
    }
}

function importGame() {
    playSfx('confirm');
    showImportTypeModal.value = true;
}

function importExeDirectly() {
    showImportTypeModal.value = false;
    exeImportForm.name = '';
    exeImportForm.path = '';
    exeImportForm.image = null;
    exeImportForm.imageName = lang.value.settings_image_not_chosen;
    playSfx('confirm');
    showExeImportModal.value = true;
}

function browseExeImportPath() {
    playSfx('confirm');
    (async () => {
        const result = await window.api.openFile(lang.value.name_exe, ['exe']);
        if (result) {
            exeImportForm.path = result;
        }
    })();
}

function handleExeImportImageSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
        exeImportForm.image = input.files[0];
        exeImportForm.imageName = input.files[0].name;
    }
}

async function confirmExeImport() {
    if (!exeImportForm.name || !exeImportForm.path) return;
    playSfx('save');

    const newGame = {
        id: `local${crypto.randomUUID()}`,
        name: { en: exeImportForm.name, zh: exeImportForm.name },
        type: 'local',
        playable: true,
        author: {
            zh: exeImportForm.author || exeImportForm.author,
            en: exeImportForm.author || exeImportForm.author
        },
        engine: exeImportForm.engine || '',
        execution_path: exeImportForm.path,
        img: defaultCover
    };

    try {
        // 优化：使用 await 处理图片读取
        if (exeImportForm.image) {
            newGame.img = await readFileAsDataURL(exeImportForm.image);
        }

        userGames.value.push(newGame);
        await window.api.setStoreValue('userGames', JSON.parse(JSON.stringify(userGames.value)));
        exeImportForm.name = '';
        exeImportForm.author = '';
        exeImportForm.engine = '';
        exeImportForm.path = '';
        exeImportForm.image = null;
        exeImportForm.imageName = lang.value.settings_image_not_chosen;
        showExeImportModal.value = false;
        selectedIndex.value = filteredList.value.findIndex(g => g.id === newGame.id);
        triggerDialog(lang.value.success, lang.value.success, 'save');
    } catch (err) {
        console.error(err);
        triggerDialog("Import Failed", lang.value.error);
    }
}

function cancelExeImport() {
    playSfx('cancel');
    showExeImportModal.value = false;
}

async function importFromAup() {
    showImportTypeModal.value = false;
    try {
        const filePath = await window.api.openFile(lang.value.name_aup, ['aup']);
        if (!filePath) return;

        playSfx('confirm');

        // 1. 开始解析前：重置进度，显示解析弹窗
        zipProgress.value = 0;
        isParsingAup.value = true;

        // 2. 调用后端解析 (这是一个耗时操作)
        // 注意：确保你的主进程 parseAup 函数在解压时会发送 'export-progress' 事件
        const aupdata = await window.api.parseAup(filePath);

        // 3. 解析完成：关闭解析弹窗
        isParsingAup.value = false;
        zipProgress.value = 0;
        // 4. 处理数据并打开选择游戏的窗口
        const games = aupdata.games;
        tmpAupDir.value = aupdata.tempDir;
        if (games && games.length > 0) {
            aupPendingGames.value = games;
            selectedAupIds.value.clear();
            showAupImportModal.value = true; // 打开选择列表
        } else {
            // 如果包里没有游戏，给个提示
            triggerDialog("No games found in this package.", lang.value.error);
            window.api.deleteFolder(tmpAupDir.value); // 清理临时目录
        }
    } catch (err: any) {
        isParsingAup.value = false; // 出错也要确保关掉弹窗
        triggerDialog(`${err}`, lang.value.error);
    }
}

const isAllAupSelected = computed(() => {
    return aupPendingGames.value.length > 0 && selectedAupIds.value.size === aupPendingGames.value.length;
});

function toggleSelectAllAup() {
    playSfx('switch');
    if (isAllAupSelected.value) {
        selectedAupIds.value.clear();
    } else {
        aupPendingGames.value.forEach(g => selectedAupIds.value.add(g.id));
    }
}

async function performAupImport() {
    if (selectedAupIds.value.size === 0) return;

    try {
        const gamesToAdd = aupPendingGames.value.filter(g => selectedAupIds.value.has(g.id));
        const userGamesMap = new Map(userGames.value.map(g => [g.id, g]));
        let finishedTasks = 0;
        zipProgress.value = 0;
        isImporting.value = true;
        // 并行移动文件夹
        const moveTasks = gamesToAdd.map(async (g) => {
            const destDir = path.join(settings.value.downloadPath, g.id);
            const newExecPath = path.join(destDir, path.basename(g.execution_path.replace(/\\/g, '/')));

            await window.api.moveFolder(path.join(tmpAupDir.value, g.id), destDir);

            const newG = { ...g, execution_path: newExecPath };
            userGamesMap.set(g.id, newG);
            zipProgress.value = Math.round(++finishedTasks / gamesToAdd.length * 100);
        });

        await Promise.all(moveTasks);

        userGames.value = [...userGamesMap.values()];

        const delayDelete = (path) => new Promise((resolve) => {
            setTimeout(async () => {
                await window.api.deleteFolder(path);
                resolve(true);
            }, 1000);
        });

        // 并行执行存储和清理
        await Promise.all([
            window.api.setStoreValue('userGames', JSON.parse(JSON.stringify(userGames.value))),
            delayDelete(tmpAupDir.value)
        ]);
        zipProgress.value = 0;
        isImporting.value = false;
        triggerDialog(lang.value.import_success, lang.value.success, 'save');
    } catch (err: any) {
        console.error("导入失败:", err);
        triggerDialog(`${err}`, lang.value.error);
    } finally {
        showAupImportModal.value = false;
    }
}

function openExportModal() {
    if (localUserGames.value.length === 0) return;
    playSfx('confirm');
    selectedExportIds.value.clear();
    showExportModal.value = true;
}

function toggleExportSelection(id: string) {
    if (isExporting.value) return;
    playSfx('switch');
    if (selectedExportIds.value.has(id)) {
        selectedExportIds.value.delete(id);
    } else {
        selectedExportIds.value.add(id);
    }
}

function cancelExport() {
    playSfx('cancel');
    showExportModal.value = false;
}

function toggleSelectAll() {
    playSfx('switch');
    if (isAllSelected.value) {
        selectedExportIds.value.clear();
    } else {
        localUserGames.value.forEach(g => {
            selectedExportIds.value.add(g.id);
        });
    }
}

function performExport() {
    if (selectedExportIds.value.size === 0) return;

    playSfx('confirm');

    (async () => {
        try {
            const saveDir = await window.api.saveFile(lang.value.name_aup, ['aup']);
            if (!saveDir) return;
            isExporting.value = true;
            // 优化：仅深拷贝需要导出的部分
            const gamesToExport = localUserGames.value.filter(g => selectedExportIds.value.has(g.id));
            await window.api.exportGame(JSON.parse(JSON.stringify(gamesToExport)), saveDir);
            triggerDialog(lang.value.export_success, lang.value.success, 'save');
        } catch (err: any) {
            triggerDialog(`${err}`, lang.value.error);
        } finally {
            isExporting.value = false;
        }
    })();
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
    // 寻找要删除的路径
    const gameId = activeGame.value.id;
    const game = userGames.value.find(g => g.id === gameId);
    if (game) execution_path = game.execution_path;

    // 更新内存状态
    userGames.value = userGames.value.filter(g => g.id !== gameId);

    selectedIndex.value = 0;
    showConfirmDelete.value = false;

    (async () => {
        // 优化：删除文件和保存配置可以并行，因为内存状态已经更新了
        await Promise.all([
            execution_path ? window.api.deleteFolder(execution_path) : Promise.resolve(),
            window.api.setStoreValue('userGames', JSON.parse(JSON.stringify(userGames.value)))
        ]);
    })();
}

function cancelDelete() {
    playSfx('cancel');
    showConfirmDelete.value = false;
}

function browseGamePath() {
    playSfx('confirm');
    (async () => {
        const result = await window.api.openFile(lang.value.name_exe, ['exe']);
        if (result) {
            settingsForm.gamePath = result;
        }
    })();
}

function openSettings() {
    playSfx('confirm');
    settingsForm.downloadPath = settings.value.downloadPath;
    settingsForm.lang = settings.value.lang;
    if (activeGame.value) {
        settingsForm.name = activeGame.value.name[currentLang.value] || activeGame.value.name['en'] || '';
        settingsForm.gamePath = activeGame.value.execution_path;
        settingsForm.imageName = activeGame.value.img ? lang.value.settings_image_current : lang.value.settings_image_not_chosen;
    }
    if (activeGame.value && activeGame.value.id.includes('local')) {
        settingsForm.author = activeGame.value.author || '';
        settingsForm.engine = activeGame.value.engine || '';
    }
    settingsForm.bgImage = null;
    settingsForm.bgImageName = settings.value.backgroundImage
        ? lang.value.settings_image_current
        : lang.value.settings_image_not_chosen;

    showSettings.value = true;
}

async function saveSettings() {
    playSfx('save');



    // 准备异步任务列表
    const tasks: Promise<any>[] = [];

    // 处理背景图片
    if (settingsForm.bgImage) {
        const bgTask = readFileAsDataURL(settingsForm.bgImage).then(data => {
            settings.value.backgroundImage = data;
        });
        tasks.push(bgTask);
    }

    // 处理游戏设置
    let gameUpdated = false;
    if (activeGame.value) {
        if (activeGame.value.type === 'local') {
            // 名字修改
            if (activeGame.value.name[currentLang.value] !== settingsForm.name) {
                console.log(currentLang.value);
                activeGame.value.name[currentLang.value] = settingsForm.name;
                gameUpdated = true;
            }
            // 路径修改
            if (activeGame.value.execution_path !== settingsForm.gamePath) {
                activeGame.value.playable = true;
                activeGame.value.execution_path = settingsForm.gamePath;
                gameUpdated = true;
            }
            // 封面图片修改
            if (settingsForm.image) {
                const imgTask = readFileAsDataURL(settingsForm.image).then(data => {
                    if (activeGame.value) activeGame.value.img = data;
                    gameUpdated = true;
                });
                tasks.push(imgTask);
            }
            if (activeGame.value.id.includes('local')) {
                // 作者修改
                if (activeGame.value.author.name[currentLang.value] !== settingsForm.author) {
                    activeGame.value.author.name[currentLang.value] = settingsForm.author;
                    gameUpdated = true;
                }
                // 引擎修改
                if (activeGame.value.engine !== settingsForm.engine) {
                    activeGame.value.engine = settingsForm.engine;
                    gameUpdated = true;
                }
            }
        }

    }
    // 更新内存中的设置状态
    settings.value.downloadPath = settingsForm.downloadPath;
    settings.value.lang = settingsForm.lang;
    // 等待所有图片读取完成
    await Promise.all(tasks);

    // 并行保存 Settings 和 UserGames
    const saveTasks: Promise<any>[] = [
        window.api.setStoreValue('settings', JSON.parse(JSON.stringify(settings.value)))
    ];

    if (gameUpdated || tasks.length > 0) { // 如果有图片更新或游戏信息变更
        saveTasks.push(window.api.setStoreValue('userGames', JSON.parse(JSON.stringify(userGames.value))));
    }

    await Promise.all(saveTasks);
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
async function cancelAupImport() {
    showAupImportModal.value = false;
    playSfx('cancel');
    window.api.deleteFolder(tmpAupDir.value);
}
function handleBgFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
        settingsForm.bgImage = input.files[0];
        settingsForm.bgImageName = input.files[0].name;
    }
}

// --- Lifecycle ---
// --- App.vue ---

onMounted(async () => {
    // 0. 初始化基础功能
    initSfx();

    window.api.onDownloadProgress((data: { id: string, percent: number }) => {
        downloadProgress[data.id] = data.percent;
    });
    window.api.onZipProgress((percent: number) => {
        zipProgress.value = percent;

    })
    try {

        // 1. 发起所有本地读取请求 (并行)
        const pGames = window.api.getStoreValue('userGames', []);
        const pSettings = window.api.getStoreValue('settings', {
            'lang': 'en',
            'downloadPath': await window.api.getdownloadpath(),
            'backgroundImage': '',
            'ignoredVersion': currentVersion
        }).catch((err) => { console.error(err) });

        // 2. 等待所有本地数据返回 (这是最快的 IO 方式)
        const [games, savedSettings] = await Promise.all([pGames, pSettings]);

        // 3. 立即应用数据，让界面不再白屏
        userGames.value = games;
        // 合并设置默认值
        settings.value = savedSettings;

    } catch (e) {
        console.error("Critical: Failed to load local data", e);
        // 如果连本地存储都读不了，这属于严重错误，可以弹个窗或者保持空状态
    }

    // ============================================================
    // 第二阶段：后台处理网络数据 (Network Background)
    // 不使用 await 阻塞 onMounted，让它在后台跑，不影响 UI 响应
    // ============================================================
    (async () => {
        try {
            // 1. 检测 IP (后端已做防崩溃处理)
            // 即使这里慢，用户也能操作本地游戏
            const ipCheckResult = await window.api.checkIsChinaIP();
            isChinaIP.value = ipCheckResult;
            console.log('Network Status - Is China IP:', ipCheckResult);

            // 2. 带有超时的 Fetch 请求
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒超时

            const configUrl = isChinaIP.value ? 'https://raw.gitcode.com/znm1145/AU-Launcher-Repo/raw/data/config.json' : 'https://cdn.jsdelivr.net/gh/znm2500/AU-Launcher-Repo@data/config.json';

            const res = await fetch(configUrl, {
                cache: 'no-store',
                signal: controller.signal // 绑定超时信号
            });

            clearTimeout(timeoutId); // 请求成功，清除定时器

            if (res.ok) {
                const data = await res.json();
                GITHUB_GAMES.value = data.games;
                if (data.newest_version !== currentVersion && data.newest_version !== settings.value.ignoredVersion) {
                    latestVersion.value = data.newest_version;
                    updateLog.value = data.update_log || {};
                    showUpdateModal.value = true;
                }
            } else {
                console.warn(`Fetch returned status: ${res.status}`);
            }

        } catch (error: any) {
            // 网络错误静默失败，不打扰用户玩本地游戏
            if (error.name === 'AbortError') {
                console.warn('Network request timed out (Offline mode active)');
            } else {
                console.warn('Network unreachable or API error:', error);
            }
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
                :class="['game-card', { selected: index === selectedIndex }]" @click="selectGame(index)"
                @dblclick="handleAction">
                <div class="card-left">
                    <img :src="soulIcon" class="soul-icon" draggable="false" />
                    <div class="info-box">
                        <div class="name">{{ game.name[currentLang] || game.name['en'] }}</div>
                        <div class="game-meta" style="font-size: 0.9rem; color: #bbb; margin-bottom: 8px;">
                            <span v-if="game.author">by {{ game.author[currentLang] || game.author['en'] }}</span>
                            <span v-if="game.engine" style="margin-left: 10px; color: #888;">[{{ game.engine }}]</span>
                        </div>
                        <div :key="force_render_key" :class="['status',
                            game.type === 'local' ? (game.playable ? 'tag-installed' : 'tag-error') :
                                game.type === 'playing' ? 'tag-playing' :  /* 新增：游玩中样式类 */
                                    (game.type === 'downloading' ? 'tag-downloading' : 'tag-download')]">
                            <template v-if="game.type === 'playing'">
                                {{ lang.playing }}
                            </template>
                            <template v-else-if="game.type === 'local'">
                                {{ game.playable ? lang.installed : lang.error }}
                            </template>
                            <template v-else-if="game.type === 'downloading'">
                                {{ lang.downloading }}
                            </template>
                            <template v-else>
                                {{ lang.to_download }}
                            </template>
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
            <div :class="['btn', { enabled: localUserGames.length > 0, disabled: localUserGames.length === 0 }]"
                @click="openExportModal">{{ lang.export }}</div>

            <div class="btn enabled" @click="openSettings">{{ lang.settings }}</div>
            <div :class="['btn', { enabled: activeGame && activeGame.type === 'local', disabled: !activeGame || activeGame.type !== 'local' }]"
                @click="confirmDelete">{{ lang.delete }}</div>
            <div :class="['btn', 'main', {
                enabled: activeGame && !activeGame.playing,
                disabled: !activeGame || activeGame.playing,
                downloading: activeGame?.type === 'downloading',
                playing: activeGame?.type === 'playing'
            }]" @click="handleAction">
                {{
                    !activeGame ? '[ --- ]' :
                        activeGame.type === 'playing' ? `[ ${lang.playing} ]` :
                            activeGame.type === 'local' ? (activeGame.playable ? lang.play : '[ --- ]') :
                                activeGame.type === 'downloading' ? `[ ${lang.downloading} ]` :
                lang.download
                }}
            </div>
        </div>
        <Transition name="fade">
            <div v-if="showUpdateModal" id="update-overlay">
                <div class="confirm-card" style="width: 480px; text-align: center;">
                    <div class="settings-title" style="color: var(--highlight-color)">
                        [ {{ lang.update_title }} ]
                    </div>
                    <div class="confirm-body" style="margin: 10px 0;">
                        {{ lang.update_msg }} <span style="color: #00FF00;">{{ latestVersion }}</span>

                        <div class="changelog-container">
                            <pre class="changelog-text">{{ updateLog[currentLang] || updateLog['en'] }}</pre>
                        </div>
                    </div>
                    <div class="confirm-actions" style="flex-direction: column; gap: 15px;">
                        <div class="btn main enabled" @click="goToDownload" style="font-size: 1.5rem;">
                            {{ lang.update_download }}
                        </div>
                        <div class="btn" @click="ignoreVersion" style="font-size: 1rem; color: #777;">
                            {{ lang.update_ignore }}
                        </div>
                    </div>
                </div>
            </div>
        </Transition>
        <Transition name="fade">
            <div v-if="showImportTypeModal" id="import-type-overlay">
                <div class="confirm-card" style="width: 480px;">
                    <div class="settings-title" style="text-align: center; margin-bottom: 25px;">[ {{ lang.import_title
                    }} ]
                    </div>
                    <div class="confirm-actions"
                        style="flex-direction: column; align-items: flex-start; gap: 20px; padding: 0 20px;">
                        <div class="btn enabled" style="font-size: 1.5rem;" @click="importExeDirectly">{{
                            lang.import_method_exe }}</div>
                        <div class="btn enabled" style="font-size: 1.5rem;" @click="importFromAup">{{
                            lang.import_method_aup
                        }}</div>
                        <div style="height: 10px; width: 100%; border-bottom: 2px solid #333;"></div>
                        <div class="btn" style="align-self: center;"
                            @click="showImportTypeModal = false; playSfx('cancel');">{{
                                lang.settings_cancel }}</div>
                    </div>
                </div>
            </div>
        </Transition>
        <Transition name="fade">
            <div v-if="isParsingAup" id="parsing-overlay">
                <div class="confirm-card" style="width: 450px; text-align: center;">
                    <div class="settings-title" style="color: var(--highlight-color); margin-bottom: 20px;">
                        [ {{ lang.parsing_title }} ]
                    </div>

                    <div class="confirm-body"
                        style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                        <div style="font-size: 1.5rem;">
                            {{ lang.import_method_aup }}
                        </div>

                        <div style="font-size: 3rem; color: white; font-family: 'fzxs';">
                            {{ zipProgress }}%
                        </div>

                        <div style="font-size: 1rem; color: #777;">
                            {{ lang.parsing_msg }}
                        </div>
                    </div>
                </div>
            </div>
        </Transition>
        <Transition name="fade">
            <div v-if="showExeImportModal" id="exe-import-overlay">
                <div class="settings-card">
                    <div class="settings-title">{{ lang.import_method_exe }}</div>
                    <div class="settings-body scrollable-settings">
                        <label>{{ lang.settings_import_name_label }} <span style="color:red">*</span></label>
                        <input type="text" v-model="exeImportForm.name" class="search-input"
                            :placeholder="lang.placeholder_game_name" />

                        <label>{{ lang.settings_import_author_label }}</label>
                        <input type="text" v-model="exeImportForm.author" class="search-input"
                            :placeholder="lang.placeholder_author" />

                        <label>{{ lang.settings_game_path_label }} <span style="color:red">*</span></label>
                        <div style="display:flex;gap:8px;align-items:center;">
                            <input type="text" v-model="exeImportForm.path" class="search-input"
                                placeholder="/Path/To/Game.exe" style="flex:1" />
                            <div class="btn browse-btn" @click="browseExeImportPath">{{ lang.settings_browse }}</div>
                        </div>

                        <label>{{ lang.settings_import_engine_label }}</label>
                        <input type="text" v-model="exeImportForm.engine" class="search-input"
                            :placeholder="lang.placeholder_engine" />

                        <label>{{ lang.settings_import_image_label }}</label>
                        <div style="display:flex;gap:8px;align-items:center;">
                            <label class="btn" for="import-exe-image-input" style="cursor: pointer;">
                                {{ lang.settings_choose_image }}
                            </label>
                            <div style="color:#ddd; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis;">
                                {{ exeImportForm.imageName }}
                            </div>
                        </div>
                        <input type="file" id="import-exe-image-input" @change="handleExeImportImageSelect"
                            accept=".jpg,.jpeg,.png,.webp,.gif" style="display:none" />
                    </div>

                    <div class="settings-actions">
                        <div :class="['btn', { enabled: exeImportForm.name && exeImportForm.path, disabled: !exeImportForm.name || !exeImportForm.path }]"
                            @click="confirmExeImport">
                            {{ lang.ok }}
                        </div>
                        <div class="btn enabled" @click="cancelExeImport">
                            {{ lang.settings_cancel }}
                        </div>
                    </div>
                </div>
            </div>
        </Transition>

        <Transition name="fade">
            <div v-if="showAupImportModal" id="aup-import-overlay">
                <div class="settings-card">
                    <div class="settings-title">{{ lang.name_aup }}</div>
                    <div class="settings-body"
                        style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                        <div
                            style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <label>{{ lang.import_aup_select_label }}</label>
                            <div class="btn" style="font-size: 0.9rem;" @click="toggleSelectAllAup">
                                {{ lang.export_select_all }}
                            </div>
                        </div>
                        <div class="export-list-container">
                            <div v-for="g in aupPendingGames" :key="g.id"
                                :class="['export-item', { selected: selectedAupIds.has(g.id) }]"
                                @click="playSfx('switch'); selectedAupIds.has(g.id) ? selectedAupIds.delete(g.id) : selectedAupIds.add(g.id)">
                                <span style="margin-right: 10px;">{{ selectedAupIds.has(g.id) ? '[x]' : '[ ]' }}</span>
                                {{ g.name[currentLang] || g.name['en'] }}
                            </div>
                        </div>
                    </div>
                    <div class="settings-actions">
                        <div :class="['btn', { enabled: selectedAupIds.size > 0 && !isImporting, disabled: selectedAupIds.size === 0 || isImporting }]"
                            @click="performAupImport">
                            {{ isImporting ? `${lang.importing}${zipProgress}%` : lang.import_aup_confirm }}
                        </div>
                        <div class="btn enabled" @click="cancelAupImport">{{
                            }}
                            {{ lang.settings_cancel }}
                        </div>
                    </div>
                </div>
            </div>
        </Transition>

        <Transition name="fade">
            <div v-if="showConfirmDelete" id="confirm-overlay">
                <div class="confirm-card">
                    <div class="confirm-body">{{ lang.confirm_del }} <span id="confirm-game-name">{{
                        activeGame ? activeGame.name[currentLang] || activeGame.name['en'] : '' }}</span>?</div>
                    <div class="confirm-actions">
                        <div class="btn enabled" @click="performDelete">{{ lang.confirm_yes }}</div>
                        <div class="btn" @click="cancelDelete">{{ lang.confirm_no }}</div>
                    </div>
                </div>
            </div>
        </Transition>

        <Transition name="fade">
            <div v-if="showExportModal" id="export-overlay">
                <div class="settings-card">
                    <div class="settings-title">{{ lang.export_title }}</div>
                    <div class="settings-body"
                        style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                        <div
                            style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <label>{{ lang.export_select_label }}</label>
                            <div class="btn" style="font-size: 0.9rem;" @click="toggleSelectAll">
                                {{ lang.export_select_all }}
                            </div>
                        </div>
                        <div class="export-list-container">
                            <div v-for="g in localUserGames" :key="g.id"
                                :class="['export-item', { selected: selectedExportIds.has(g.id) }]"
                                @click="toggleExportSelection(g.id)">
                                <span style="margin-right: 10px;">{{ selectedExportIds.has(g.id) ? '[x]' : '[ ]'
                                }}</span>
                                {{ g.name[currentLang] || g.name['en'] }}
                            </div>
                        </div>
                    </div>
                    <div class="settings-actions">
                        <div :class="['btn', { enabled: selectedExportIds.size > 0 && !isExporting, disabled: selectedExportIds.size === 0 || isExporting }]"
                            @click="performExport">
                            {{ isExporting ? `${lang.exporting}${zipProgress}%` : lang.export_confirm }}
                        </div>
                        <div class="btn enabled" @click="cancelExport">
                            {{ lang.settings_cancel }}
                        </div>
                    </div>
                </div>
            </div>
        </Transition>

        <Transition name="fade">
            <div v-if="showSettings" id="settings-overlay">
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
                                <div style="color:#ddd; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis;">
                                    {{
                                        settingsForm.imageName
                                    }}</div>
                            </div>
                            <input type="file" id="setting-game-image-input" @change="handleFileSelect"
                                accept=".jpg,.jpeg,.png,.webp,.gif" style="display:none" />
                            <label>{{ lang.settings_game_path_label }}</label>
                            <div style="display:flex;gap:8px;align-items:center;">
                                <input type="text" v-model="settingsForm.gamePath" class="search-input"
                                    :placeholder="lang.placeholder_download_path" style="flex:1" />
                                <div class="btn browse-btn" @click="browseGamePath">{{ lang.settings_browse }}</div>
                            </div>
                            <template v-if="activeGame.id.includes('local')">
                                <label>{{ lang.settings_import_author_label }}</label>
                                <input type="text" v-model="settingsForm.author" class="search-input"
                                    :placeholder="lang.placeholder_author" />
                                <label>{{ lang.settings_import_engine_label }}</label>
                                <input type="text" v-model="settingsForm.engine" class="search-input"
                                    :placeholder="lang.placeholder_engine" />
                            </template>
                        </template>
                    </div>
                    <div class="settings-actions">
                        <div class="btn enabled" @click="saveSettings">{{ lang.settings_save }}</div>
                        <div class="btn" @click="cancelSettings" id="settings-cancel">{{ lang.settings_cancel }}</div>
                    </div>
                </div>
            </div>
        </Transition>

        <Transition name="fade">
            <div v-if="showErrorModal" id="error-overlay">
                <div class="error-card">
                    <div class="error-header">
                        <span class="error-title">{{ errorTitle }}</span>
                    </div>
                    <div class="error-body">
                        {{ errorMessage }}
                    </div>
                    <div class="error-actions">
                        <div class="btn main enabled" @click="closeError">{{ lang.ok }}</div>
                    </div>
                </div>
            </div>
        </Transition>
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
}

/* --- Vue 过渡动画 --- */
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.24s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

/* --- 顶部栏 --- */
.top-bar {
    max-width: 1200px;
    width: 75%;
    margin-top: 30px;
    display: flex;
    justify-content: center;
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
    gap: 40px;
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

.btn.enabled {
    color: white;
    pointer-events: auto;
}

.btn.enabled:hover {
    color: var(--highlight-color);
}

.btn.downloading {
    color: #fff !important;
    cursor: default;
    pointer-events: none;
    opacity: 0.8;
}
.btn.playing {
    color: #fff !important;
    cursor: default;
    pointer-events: none;
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
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23FFFFFF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E");
    background-repeat: no-repeat;
    background-position: right 10px top 50%;
    background-size: 12px auto;
}

.retro-select:hover {
    background-color: #222;
}

.retro-select option {
    background: black;
    color: white;
    padding: 10px;
}

/* 模态框通用样式 - 移除了 .show，改用 Vue Transition 控制 */
#confirm-overlay,
#settings-overlay,
#error-overlay,
#export-overlay,
#import-type-overlay,
#aup-import-overlay,
#exe-import-overlay,
#update-overlay,
#parsing-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.8);
    z-index: 9999;
}

.confirm-card,
.settings-card,
.error-card {
    background: rgba(0, 0, 0, 0.95);
    border: 5px solid white;
    padding: 20px;
    box-sizing: border-box;
    /* 核心限制：确保不溢出屏幕 */
    width: 550px;
    max-width: 90vw;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    gap: 10px;
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

/* 全局滚动条样式定义 */
#game-list::-webkit-scrollbar,
.scrollable-settings::-webkit-scrollbar,
.export-list-container::-webkit-scrollbar {
    width: 10px;
}

#game-list::-webkit-scrollbar-track,
.scrollable-settings::-webkit-scrollbar-track,
.export-list-container::-webkit-scrollbar-track {
    background: #000;
}

#game-list::-webkit-scrollbar-thumb,
.scrollable-settings::-webkit-scrollbar-thumb,
.export-list-container::-webkit-scrollbar-thumb {
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
    color: white;
}

.error-body {
    font-size: 1.2rem;
    min-height: 60px;
    word-break: break-all;
    flex-grow: 1;
    /* 自动撑开 */
    overflow-y: auto;
    /* 内容多时显示滚动条 */
    padding-right: 10px;
    margin: 10px 0;
    line-height: 1.4;
    color: #eee;
}

.error-actions {
    flex-shrink: 0;
    /* 按钮区域固定在底部 */
    display: flex;
    justify-content: flex-end;
    margin-top: 10px;
}

/* --- 复用自定义滚动条 --- */
.error-body::-webkit-scrollbar {
    width: 10px;
}

.error-body::-webkit-scrollbar-track {
    background: #000;
}

.error-body::-webkit-scrollbar-thumb {
    background: #fff;
}

.error-actions .btn {
    font-size: 1.6rem;
    padding: 10px 25px;
}

.export-list-container {
    border: 2px solid #333;
    padding: 5px;
    height: 300px;
    overflow-y: auto;
    background: black;
}

.export-item {
    padding: 10px 15px;
    border: 2px solid transparent;
    cursor: pointer;
    font-size: 1.3rem;
    transition: all 0.2s;
    color: #aaa;
    display: flex;
    align-items: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.export-item:hover {
    color: white;
    background: #111;
}

.export-item.selected {
    border: 2px solid white;
    color: white;
    background: #222;
    box-shadow: 0 0 5px rgba(255, 255, 255, 0.2);
}

/* 新增：更新日志容器样式 */
.changelog-container {
    margin-top: 15px;
    background: rgba(255, 255, 255, 0.05);
    /* 半透明黑背景 */
    border: 2px solid #444;
    /* 深灰色边框 */
    padding: 10px;
    text-align: left;
    /* 日志左对齐 */
    max-height: 160px;
    /* 限制高度，防止撑开弹窗 */
    overflow-y: auto;
    /* 内容多时显示滚动条 */
}

.tag-playing {  
    color: #00ffcc;
    animation: blink 1.5s infinite;
    /* 增加一个呼吸灯动画 */
}

/* 简单的呼吸灯动画 */
@keyframes blink {
    0% {
        opacity: 1;
    }

    50% {
        opacity: 0.6;
    }

    100% {
        opacity: 1;
    }
}

.changelog-text {
    font-family: 'fzxs', monospace;
    font-size: 0.9rem;
    color: #ccc;
    white-space: pre-wrap;
    /* 识别 \n 换行符 */
    word-break: break-all;
    margin: 0;
    line-height: 1.5;
}

/* 复用你已有的白色滚动条样式 */
.changelog-container::-webkit-scrollbar {
    width: 6px;
}

.changelog-container::-webkit-scrollbar-thumb {
    background: #fff;
}

.changelog-container::-webkit-scrollbar-track {
    background: #000;
}
</style>