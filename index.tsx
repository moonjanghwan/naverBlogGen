
import { GoogleGenAI } from '@google/genai';
// @ts-ignore
import { marked } from 'marked';

// UI Elements
const statusContainer = document.getElementById('status-container') as HTMLElement;
const sheetIdInput = document.getElementById('sheet-id') as HTMLInputElement;
const sheetNameInput = document.getElementById('sheet-name') as HTMLInputElement;
const manualTitleInput = document.getElementById('manual-title') as HTMLInputElement;
const manualUrlInput = document.getElementById('manual-url') as HTMLInputElement;
const textModelSelect = document.getElementById('text-model') as HTMLSelectElement;
const imageModelSelect = document.getElementById('image-model') as HTMLSelectElement;
const runAutomationBtn = document.getElementById('run-automation') as HTMLButtonElement;
const runManualBtn = document.getElementById('run-manual') as HTMLButtonElement;
const copyAllBtn = document.getElementById('copy-all-btn') as HTMLButtonElement;

const genImageBtn = document.getElementById('gen-image-btn') as HTMLButtonElement;

// Tab-based canvases
const newsCanvas = document.getElementById('news-canvas') as HTMLElement;
const googleCanvas = document.getElementById('google-canvas') as HTMLElement;
const naverCanvas = document.getElementById('naver-canvas') as HTMLElement;
const blogCanvas = document.getElementById('blog-canvas') as HTMLElement;
const editorCanvas = blogCanvas; // Backward compatibility alias

const tabNews = document.getElementById('tab-news') as HTMLButtonElement;
const tabGoogle = document.getElementById('tab-google') as HTMLButtonElement;
const tabNaver = document.getElementById('tab-naver') as HTMLButtonElement;
const tabBlog = document.getElementById('tab-blog') as HTMLButtonElement;

// Tab switching function
function switchToTab(tab: 'news' | 'google' | 'naver' | 'blog') {
  // Hide all
  newsCanvas?.classList.add('hidden');
  googleCanvas?.classList.add('hidden');
  naverCanvas?.classList.add('hidden');
  blogCanvas?.classList.add('hidden');

  // Deactivate all tabs
  [tabNews, tabGoogle, tabNaver, tabBlog].forEach(t => {
    t?.classList.remove('text-emerald-600', 'border-emerald-500', 'bg-white', 'text-indigo-600', 'border-indigo-500', 'active', 'text-blue-600', 'border-blue-500', 'text-green-600', 'border-green-500');
    t?.classList.add('text-gray-400', 'border-transparent');
  });

  // Show Active
  if (tab === 'news') {
    newsCanvas?.classList.remove('hidden');
    tabNews?.classList.add('text-emerald-600', 'border-emerald-500', 'bg-white');
    tabNews?.classList.remove('text-gray-400', 'border-transparent');
  } else if (tab === 'google') {
    googleCanvas?.classList.remove('hidden');
    tabGoogle?.classList.add('text-blue-600', 'border-blue-500', 'bg-white');
    tabGoogle?.classList.remove('text-gray-400', 'border-transparent');
  } else if (tab === 'naver') {
    naverCanvas?.classList.remove('hidden');
    tabNaver?.classList.add('text-green-600', 'border-green-500', 'bg-white');
    tabNaver?.classList.remove('text-gray-400', 'border-transparent');
  } else if (tab === 'blog') {
    blogCanvas?.classList.remove('hidden');
    tabBlog?.classList.add('text-indigo-600', 'border-indigo-500', 'bg-white');
    tabBlog?.classList.remove('text-gray-400', 'border-transparent');
  }
}

// Tab click handlers
tabNews?.addEventListener('click', () => switchToTab('news'));
tabGoogle?.addEventListener('click', () => switchToTab('google'));
tabNaver?.addEventListener('click', () => switchToTab('naver'));
tabBlog?.addEventListener('click', () => switchToTab('blog'));

marked.setOptions({
  breaks: true,
  gfm: true,


});

// Global State
let accumulatedHtml = "";

// Persistence Keys
const STORAGE_KEYS = {
  SHEET_ID: 'gemini_automator_sheet_id',
  SHEET_NAME: 'gemini_automator_sheet_name',
  TEXT_MODEL: 'gemini_automator_text_model',
  IMAGE_MODEL: 'gemini_automator_image_model',
  MANUAL_TITLE: 'gemini_automator_manual_title',
  MANUAL_URL: 'gemini_automator_manual_url',
  AUTO_TIME: 'gemini_auto_time',
  AUTO_SITES: 'gemini_auto_sites',
  AUTO_KEYWORDS: 'gemini_auto_keywords',
  AUTO_WEBHOOK: 'gemini_auto_webhook',
  AUTO_SHEET_NAME_SAVE: 'gemini_auto_sheet_name_save',
  NEWS_HTML: 'gemini_news_html',
  GOOGLE_HTML: 'gemini_google_html',
  NAVER_HTML: 'gemini_naver_html',
  NEWS_DATA: 'gemini_news_data',
  GOOGLE_DATA: 'gemini_google_data',
  NAVER_DATA: 'gemini_naver_data',
  BLOG_HTML: 'gemini_blog_html'
};

// State Management Functions
function saveAppState() {
  if (newsCanvas) localStorage.setItem(STORAGE_KEYS.NEWS_HTML, newsCanvas.innerHTML);
  if (googleCanvas) localStorage.setItem(STORAGE_KEYS.GOOGLE_HTML, googleCanvas.innerHTML);
  if (naverCanvas) localStorage.setItem(STORAGE_KEYS.NAVER_HTML, naverCanvas.innerHTML);

  if ((window as any).scraperItems) localStorage.setItem(STORAGE_KEYS.NEWS_DATA, JSON.stringify((window as any).scraperItems));
  if ((window as any).googleItems) localStorage.setItem(STORAGE_KEYS.GOOGLE_DATA, JSON.stringify((window as any).googleItems));
  if ((window as any).naverItems) localStorage.setItem(STORAGE_KEYS.NAVER_DATA, JSON.stringify((window as any).naverItems));

  if (blogCanvas) localStorage.setItem(STORAGE_KEYS.BLOG_HTML, blogCanvas.innerHTML);
}

function restoreAppState() {
  const newsHtml = localStorage.getItem(STORAGE_KEYS.NEWS_HTML);
  const googleHtml = localStorage.getItem(STORAGE_KEYS.GOOGLE_HTML);
  const naverHtml = localStorage.getItem(STORAGE_KEYS.NAVER_HTML);

  const newsData = localStorage.getItem(STORAGE_KEYS.NEWS_DATA);
  const googleData = localStorage.getItem(STORAGE_KEYS.GOOGLE_DATA);
  const naverData = localStorage.getItem(STORAGE_KEYS.NAVER_DATA);
  const blogHtml = localStorage.getItem(STORAGE_KEYS.BLOG_HTML);

  // Restore Data First
  if (newsData) (window as any).scraperItems = JSON.parse(newsData);
  if (googleData) (window as any).googleItems = JSON.parse(googleData);
  if (naverData) (window as any).naverItems = JSON.parse(naverData);

  // Default active items to news/scraper items if available, else empty
  // Ideally we should switch context based on active tab, but for now just load them.
  if ((window as any).scraperItems) (window as any).scrapedNewsItems = (window as any).scraperItems;

  // Helper to re-attach listeners
  const reattachListeners = (containerId: string, prefix: string, activeColor: string, defaultColor: string, itemsSource: any[]) => {
    const containerEl = document.getElementById(containerId);
    if (containerEl) {
      const selectAllBtn = document.getElementById(`select-all-${prefix}-btn`);
      const deselectAllBtn = document.getElementById(`deselect-all-${prefix}-btn`);

      selectAllBtn?.addEventListener('click', () => {
        const checkboxes = containerEl.querySelectorAll('.news-checkbox') as NodeListOf<HTMLInputElement>;
        checkboxes.forEach(cb => {
          cb.checked = true;
          const parent = cb.closest('.news-item') as HTMLElement;
          if (parent) parent.style.borderColor = activeColor;
        });
      });

      deselectAllBtn?.addEventListener('click', () => {
        const checkboxes = containerEl.querySelectorAll('.news-checkbox') as NodeListOf<HTMLInputElement>;
        checkboxes.forEach(cb => {
          cb.checked = false;
          const parent = cb.closest('.news-item') as HTMLElement;
          if (parent) parent.style.borderColor = defaultColor;
        });
      });

      containerEl.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (target && target.classList.contains('news-checkbox')) {
          const parent = target.closest('.news-item') as HTMLElement;
          if (parent) parent.style.borderColor = target.checked ? activeColor : defaultColor;
        }
      });

      // Re-attach translate using the correct items source
      attachTranslateHandler(`translate-${prefix}-btn`, itemsSource, prefix);
    }
  };

  if (newsHtml && newsCanvas) {
    newsCanvas.innerHTML = newsHtml;
    reattachListeners('news-results-container', 'news', '#10b981', '#e5e7eb', (window as any).scraperItems);
  }

  if (googleHtml && googleCanvas) {
    googleCanvas.innerHTML = googleHtml;
    reattachListeners('google-results-container', 'google', '#4285f4', '#bfdbfe', (window as any).googleItems);
  }

  if (naverHtml && naverCanvas) {
    naverCanvas.innerHTML = naverHtml;
    reattachListeners('naver-results-container', 'naver', '#22c55e', '#bbf7d0', (window as any).naverItems);
  }

  if (blogHtml && blogCanvas) {
    blogCanvas.innerHTML = blogHtml;
    // Re-attach listeners for blog if any
  }
}

// Auto-save on blog edit (simple debounce)
let blogSaveTimeout: any;
blogCanvas?.addEventListener('input', () => {
  clearTimeout(blogSaveTimeout);
  blogSaveTimeout = setTimeout(saveAppState, 1000);
});

/**
 * Updates the global progress indicator and status text.
 * Now renders a centered loading state in the canvas.
 */
function setGlobalStatus(isLoading: boolean, text: string = "") {
  if (isLoading) {
    editorCanvas.innerHTML = `
      <div class="flex items-center justify-center h-full min-h-[400px] flex-col gap-4">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <div class="text-center text-gray-500 font-bold animate-pulse">
            ${text}<br>
            <span class="text-sm font-normal text-gray-400">잠시만 기다려주세요!</span>
        </div>
      </div>
    `;
  }
}

/**
 * Sets a button to a loading state.
 */
function setButtonLoading(btn: HTMLButtonElement | null, isLoading: boolean, loadingText: string = "Working...") {
  if (!btn) return;
  if (isLoading) {
    if (!btn.dataset.originalText) {
      btn.dataset.originalText = btn.innerHTML;
    }
    btn.innerHTML = `<svg class="animate-spin h-4 w-4 inline mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> ${loadingText}`;
    btn.disabled = true;
    btn.classList.add('opacity-75', 'cursor-not-allowed');
  } else {
    btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
    btn.disabled = false;
    btn.classList.remove('opacity-75', 'cursor-not-allowed');
  }
}


const messageWindow = document.getElementById('message-window') as HTMLElement;
let isMessageWindowInitialized = false;

/**
 * Adds a log entry to the unified message window.
 */
function addLog(id: string, title: string, message: string, type: 'success' | 'error' | 'info' | 'result') {
  if (!messageWindow) return;

  // Clear initial placeholder if first message
  if (!isMessageWindowInitialized) {
    messageWindow.innerHTML = '';
    isMessageWindowInitialized = true;
  }

  // Create message bubble
  const msgDiv = document.createElement('div');
  msgDiv.id = id;
  msgDiv.className = `p-3 rounded-xl text-xs mb-2 border animate-fadeIn ${type === 'success' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
    type === 'error' ? 'bg-red-50 text-red-700 border-red-100' :
      type === 'result' ? 'bg-white border-2 border-emerald-400 shadow-md' : // Highlight results
        'bg-gray-50 text-gray-600 border-gray-200'
    }`;

  // Use different icon based on type
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'result' ? '🎉' : 'ℹ️';

  // For results, we might want special formatting
  if (type === 'result') {
    msgDiv.innerHTML = `
        <div class="flex items-start gap-2">
            <span class="text-lg">${icon}</span>
            <div class="flex-1">
                <div class="font-bold text-emerald-700 mb-1">${title}</div>
                <div class="text-gray-600 mb-2">${message}</div>
                <div class="flex gap-1 justify-end">
                    <span class="text-[9px] bg-emerald-100 text-emerald-600 px-2 py-1 rounded-full font-bold">생성 완료</span>
                </div>
            </div>
        </div>
      `;
  } else {
    msgDiv.innerHTML = `
        <div class="flex items-start gap-2">
            <span>${icon}</span>
            <div>
                <span class="font-bold block mb-0.5">${title}</span>
                <span class="opacity-90 leading-relaxed">${message}</span>
            </div>
        </div>
      `;
  }

  messageWindow.appendChild(msgDiv);
  // Auto-scroll to bottom
  messageWindow.scrollTop = messageWindow.scrollHeight;
}



/**
 * Extracts the spreadsheet ID from a Google Sheets URL.
 */
function extractIdFromUrl(url: string): string {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : url;
}



function initPersistence() {
  const savedSheetId = localStorage.getItem(STORAGE_KEYS.SHEET_ID);
  const savedSheetName = localStorage.getItem(STORAGE_KEYS.SHEET_NAME);
  const savedTextModel = localStorage.getItem(STORAGE_KEYS.TEXT_MODEL);
  const savedImageModel = localStorage.getItem(STORAGE_KEYS.IMAGE_MODEL);
  const savedManualTitle = localStorage.getItem(STORAGE_KEYS.MANUAL_TITLE);
  const savedManualUrl = localStorage.getItem(STORAGE_KEYS.MANUAL_URL);

  // Only set if elements exist
  if (savedSheetId && sheetIdInput) sheetIdInput.value = savedSheetId;
  if (savedSheetName && sheetNameInput) sheetNameInput.value = savedSheetName;
  if (savedTextModel && textModelSelect) textModelSelect.value = savedTextModel;
  if (savedImageModel && imageModelSelect) imageModelSelect.value = savedImageModel;
  if (savedManualTitle && manualTitleInput) manualTitleInput.value = savedManualTitle;
  if (savedManualUrl && manualUrlInput) manualUrlInput.value = savedManualUrl;

  // Only add listeners if elements exist
  sheetIdInput?.addEventListener('input', () => localStorage.setItem(STORAGE_KEYS.SHEET_ID, sheetIdInput.value));
  sheetNameInput?.addEventListener('input', () => localStorage.setItem(STORAGE_KEYS.SHEET_NAME, sheetNameInput.value));
  textModelSelect?.addEventListener('change', () => localStorage.setItem(STORAGE_KEYS.TEXT_MODEL, textModelSelect.value));
  imageModelSelect?.addEventListener('change', () => localStorage.setItem(STORAGE_KEYS.IMAGE_MODEL, imageModelSelect.value));
  manualTitleInput?.addEventListener('input', () => localStorage.setItem(STORAGE_KEYS.MANUAL_TITLE, manualTitleInput.value));
  manualUrlInput?.addEventListener('input', () => localStorage.setItem(STORAGE_KEYS.MANUAL_URL, manualUrlInput.value));
}

const SYSTEM_INSTRUCTION = `
당신은 네이버 블로그 '곰발바닥 1956'의 수석 에디터이자 SEO 마스터입니다.
당신의 임무는 독자의 클릭을 유도하는 **임팩트 있는 도입부**와 **팩트체크 기반의 고품질 원고**를 작성하는 것입니다.

[절대 금지 사항 - 마크다운 제거]
1. 원고 내에서 #, ##, ###, ****, __, \`, ~~ 와 같은 **마크다운 기호를 절대 사용하지 마세요.**
2. 강조를 위해 **text** 처럼 별표를 사용하는 대신 반드시 <b>text</b> 태그를 사용하세요.
3. 제목은 <h1>, 중간 구분은 <h2>, 세부 항목은 <h3> 태그를 사용하세요.

[편집 구조 및 가독성 규칙]
1. **제목(H1)**: 클릭을 유도하는 강력한 헤드라인.
2. **SEO 도입부**: 제목 직후, 별도의 라벨 없이 공감과 훅으로 시작하세요.
3. **팩트체크 인용구**: 
   - 핵심 수치나 팩트는 반드시 <blockquote> 태그로 감싸세요. (내부에 FACT CHECK 등의 문구 삽입 금지)
4. **가독성**: 한 문장은 30자 내외, 1~2문장마다 <br><br>을 넣어 시각적 여백을 만드세요.
5. **강조**: 핵심 키워드는 <b> 태그로만 강조하세요.
6. **소제목**: 각 챕터의 세부 주제는 <h3>를 사용하여 본문과 구분하세요.

[특수 태그]
- 이미지: [[IMAGE_PROMPT: ...]]
- 해시태그: [[TAGS: #태그1...#태그10]] (10개 이상)
`;

function processAIOutputToHtml(rawText: string): string {
  // 1. 이미지 및 태그 분리 전, 모든 마크다운 특수 기호 강제 제거 (Regex)
  // # 기호 제거 (단, URL 등은 제외하기 위해 공백이나 줄바꿈 뒤의 # 제거)
  let cleaned = rawText.replace(/(^|\n)#+\s+/g, '$1');
  // **, __, ` 등 기호만 제거 (태그는 남김)
  cleaned = cleaned.replace(/\*\*|__|`|~~/g, '');

  // 2. 메타 라벨 제거
  cleaned = cleaned.replace(/\[SEO 도입부.*?\]/gi, '');
  cleaned = cleaned.replace(/\[Intro Hook.*?\]/gi, '');

  // 3. TAGS 추출 및 제거
  const tagsMatch = cleaned.match(/\[\[\s*TAGS\s*:\s*(.*?)\s*\]\]/i);
  cleaned = cleaned.replace(/\[\[\s*TAGS\s*:\s*(.*?)\s*\]\]/gi, '');

  // 4. HTML 파싱 (marked를 거치더라도 이미 기호가 제거된 상태)
  let html = marked.parse(cleaned) as string;

  // 5. 이미지 프롬프트 변환
  const pattern = /\[\[\s*IMAGE_PROMPT\s*:\s*(.*?)\s*\]\]/gi;
  html = html.replace(pattern, (match, p1) => {
    const promptText = p1.trim();
    const safePrompt = promptText.replace(/'/g, "&apos;").replace(/"/g, "&quot;");
    return `
        <div class="image-prompt-box" data-prompt="${safePrompt}">
            <div class="header">🎨 AI VISUAL CONTENT</div>
            <div class="content">${promptText}</div>
            <div class="image-result-area flex flex-col items-center gap-4 mt-4 hidden"></div>
        </div>`;
  });

  // 6. 최종 정제: 불필요한 코드 블럭 마크업 등 제거
  return html.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '');
}

async function generateArticle(title: string, content: string, link: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = textModelSelect.value;

  const isCompatibleWithThinking = model.includes('gemini-2.5') || model.includes('gemini-3');
  const config: any = {
    systemInstruction: SYSTEM_INSTRUCTION,
    tools: [{ googleSearch: {} }]
  };

  if (isCompatibleWithThinking) {
    config.thinkingConfig = { thinkingBudget: 24576 };
  }

  const prompt = `[미션] 마크다운 기호를 100% 제거한 순수 HTML 기반 원고 집필\n\n주제: ${title}\n자료: ${content}\n참고: ${link}\n\n[필수 명령]\n- #, ##, **, __ 기호 사용 시 즉시 탈락\n- 제목은 <h1>, 중간 구분은 <h2>, 세부 항목은 <h3> 태그 사용\n- 팩트는 <blockquote> 사용\n- [[IMAGE_PROMPT: ...]] 3개 이상 배치\n- [[TAGS: ...]] 10개 이상.`;

  const response = await ai.models.generateContent({
    model: model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: config
  });

  const articleText = response.text || "";
  const promptMatches = Array.from(articleText.matchAll(/\[\[\s*IMAGE_PROMPT\s*:\s*(.*?)\s*\]\]/gi));
  const prompts = promptMatches.map(m => m[1].trim());
  const tagMatch = articleText.match(/\[\[\s*TAGS\s*:\s*([\s\S]*?)\s*\]\]/i);
  const tags = tagMatch ? tagMatch[1].split(',').map(t => t.trim()).filter(t => t !== "") : [];
  const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

  return {
    text: articleText,
    prompts: prompts,
    tags: tags,
    groundingChunks: groundingMetadata?.groundingChunks || [],
    searchQueries: groundingMetadata?.webSearchQueries || []
  };
}

async function addToAccumulatedDoc(title: string, articleData: { text: string, prompts: string[], tags: string[], groundingChunks?: any[], searchQueries?: string[] }) {
  const processedContent = processAIOutputToHtml(articleData.text);

  let promptsHtml = articleData.prompts.map(p => `
    <div class="p-3 bg-white border border-gray-100 rounded-xl text-[11px] text-gray-500 italic">
      📍 ${p}
    </div>
  `).join("");

  let tagsHtml = articleData.tags.map(t => `
    <span class="inline-block px-3 py-1 bg-white border border-blue-100 rounded-full text-[11px] text-blue-600 font-bold shadow-sm">${t.startsWith('#') ? t : '#' + t}</span>
  `).join("");

  let groundingHtml = "";
  if (articleData.groundingChunks && articleData.groundingChunks.length > 0) {
    groundingHtml = articleData.groundingChunks
      .filter(c => c.web)
      .map((c, idx) => `
        <a href="${c.web.uri}" target="_blank" class="flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-2xl hover:border-blue-300 transition-all">
          <div class="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center text-[10px] text-blue-600 font-black">${idx + 1}</div>
          <div class="flex-1 min-w-0 text-[11px] font-bold text-gray-800 truncate">${c.web.title || "Ref"}</div>
        </a>
      `).join("");
  }

  let searchQueriesHtml = "";
  if (articleData.searchQueries && articleData.searchQueries.length > 0) {
    searchQueriesHtml = articleData.searchQueries.map(q => `
        <div class="px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg text-[11px] text-blue-700 font-medium whitespace-nowrap">
            🔍 ${q}
        </div>
      `).join("");
  }

  const metadataSection = `
    <div class="resource-metadata-card animate__animated animate__fadeIn">
      <div class="flex items-center gap-3 mb-10">
        <div class="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-sm shadow-xl shadow-indigo-100">📋</div>
        <div>
          <h3 class="text-sm font-black text-gray-900 uppercase tracking-tight">Resource Metadata</h3>
          <p class="text-[10px] text-gray-400 font-medium">콘텐츠 분석 및 출처 리포트</p>
        </div>
      </div>

      ${promptsHtml ? `<div class="mb-12"><div class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Visual Directing</div><div class="grid grid-cols-1 gap-2.5">${promptsHtml}</div></div>` : ''}
      ${searchQueriesHtml ? `<div class="mb-12"><div class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">AI Web Search</div><div class="flex flex-wrap gap-2">${searchQueriesHtml}</div></div>` : ''}
      ${tagsHtml ? `<div class="mb-12"><div class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">SEO Tags</div><div class="flex flex-wrap gap-2.5 p-6 bg-white border border-blue-50 rounded-[1.5rem]">${tagsHtml}</div></div>` : ''}
      ${groundingHtml ? `<div><div class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Grounding Sources</div><div class="grid grid-cols-1 md:grid-cols-2 gap-3">${groundingHtml}</div></div>` : ''}
    </div>
  `;

  const postId = `post-${Date.now()}`;
  const sectionHtml = `
    <article class="doc-section mb-32 pb-32 border-b-2 border-dashed border-gray-100" data-post-id="${postId}">
      <div class="section-badge">SESSION: ${title}</div>
      <div class="blog-content-wrapper">
        ${processedContent}
        ${metadataSection}
      </div>
    </article>
  `;

  accumulatedHtml += sectionHtml;
  blogCanvas.innerHTML = accumulatedHtml;

  // Auto-switch to blog tab when content is added
  switchToTab('blog');

  // Track generated post
  if (!(window as any).generatedBlogPosts) {
    (window as any).generatedBlogPosts = [];
  }
  (window as any).generatedBlogPosts.push({
    id: postId,
    title: title,
    html: sectionHtml,
    selected: true
  });

  addLog(`accum-${Date.now()}`, title, `블로그 글 생성이 완료되었습니다.`, 'result');
}

// Function to update the Generated Posts list in sidebar (RADIO - single select)
function updateGeneratedPostsList() {
  const posts = (window as any).generatedBlogPosts || [];
  if (posts.length === 0) return;
}

genImageBtn.onclick = async () => {
  const boxes = document.querySelectorAll('.image-prompt-box');
  const pendingBoxes = Array.from(boxes).filter(box => !box.querySelector('img'));
  if (pendingBoxes.length === 0) return alert("생성할 이미지가 없습니다.");

  setButtonLoading(genImageBtn, true, "생성중...");

  for (let box of pendingBoxes) {
    const prompt = (box as HTMLElement).getAttribute('data-prompt');
    if (prompt) {
      // True: Auto download enabled for batch
      await generateImageWithPrompt(box as HTMLElement, prompt, true);
    }
  }

  setButtonLoading(genImageBtn, false);
  setGlobalStatus(false);
};

// 독립적인 이미지 생성 함수 (재생성 기능 포함)
async function generateImageWithPrompt(box: HTMLElement, promptText: string, autoSave: boolean = false) {
  const resultArea = box.querySelector('.image-result-area') as HTMLElement;
  if (!resultArea) return;

  try {
    resultArea.innerHTML = `<div class="p-4 text-[10px] text-indigo-500 font-bold animate-pulse">✨ AI Rendering...</div>`;
    resultArea.classList.remove('hidden');

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // Fix: Use correct ID matching HTML
    const modelSelect = document.getElementById('image-model') as HTMLSelectElement;
    const modelName = modelSelect ? modelSelect.value : "gemini-2.5-flash-image";

    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts: [{ text: promptText }] },
      config: { imageConfig: { aspectRatio: "1:1" } } as any
    });

    let imageUrl = "";
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        imageUrl = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }

    if (imageUrl) {
      resultArea.innerHTML = `
                <img src="${imageUrl}" class="w-full h-auto rounded-xl shadow-2xl border border-gray-100">
                <div class="flex items-center justify-center gap-2 mt-4">
                    <button class="download-trigger-btn bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-[10px] font-bold shadow-lg transition-all flex items-center gap-1">
                        ⬇️ Download
                    </button>
                    <button class="regen-trigger-btn bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl text-[10px] font-bold shadow-sm transition-all flex items-center gap-1">
                        🔄 재생성 (프롬프트 수정)
                    </button>
                </div>
            `;

      (resultArea.querySelector('.download-trigger-btn') as HTMLButtonElement).onclick = () => downloadImage(imageUrl);

      if (autoSave) {
        downloadImage(imageUrl);
      }

      // Regenerate Handler
      (resultArea.querySelector('.regen-trigger-btn') as HTMLButtonElement).onclick = async () => {
        const newPrompt = prompt("추가하거나 수정할 프롬프트를 입력하세요:", promptText);
        if (newPrompt && newPrompt.trim() !== "") {
          // Update data-prompt attribute to reflect the new prompt
          box.setAttribute('data-prompt', newPrompt);
          await generateImageWithPrompt(box, newPrompt, false); // Manual regen: no auto-save by default
        }
      };
    }
  } catch (e) {
    console.error(e);
    resultArea.innerHTML = `<div class="p-2 text-rose-500 text-[10px]">Error: Generation Failed</div>`;
  }
}




copyAllBtn.onclick = async () => {
  const originalText = copyAllBtn.innerHTML;
  copyAllBtn.innerHTML = `<svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> 복사 중...`;
  copyAllBtn.disabled = true;

  const posts = (window as any).generatedBlogPosts || [];
  const selectedPost = posts.find((p: any) => p.selected);

  // If we have generated posts, copy only the selected one
  if (selectedPost) {
    // Create temp element with selected post HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = selectedPost.html;

    // Apply inline styles for Naver Blog compatibility
    applyInlineStyles(tempDiv);

    const htmlBlob = new Blob([tempDiv.innerHTML], { type: 'text/html' });
    const textBlob = new Blob([tempDiv.innerText], { type: 'text/plain' });

    await navigator.clipboard.write([new ClipboardItem({
      'text/html': htmlBlob,
      'text/plain': textBlob
    })]);

    alert(`"${selectedPost.title}" 복사 완료!`);
    return;
  }

  // Fallback: Copy all canvas content if no generated posts
  if (!editorCanvas.innerHTML) return;

  // 1. 임시 복제본 생성
  const clone = editorCanvas.cloneNode(true) as HTMLElement;

  // 2. 이미지 결과 영역 제거
  const resultAreas = clone.querySelectorAll('.image-result-area');
  resultAreas.forEach(area => {
    area.innerHTML = '';
    area.classList.add('hidden');
  });

  // Apply inline styles
  applyInlineStyles(clone);

  // 4. 클립보드에 복사
  const htmlBlob = new Blob([clone.innerHTML], { type: 'text/html' });
  const textBlob = new Blob([clone.innerText], { type: 'text/plain' });

  const data = [new ClipboardItem({
    'text/html': htmlBlob,
    'text/plain': textBlob
  })];

  await navigator.clipboard.write(data);

  // Show success state
  copyAllBtn.innerHTML = '✅ 복사 완료!';
  setTimeout(() => {
    copyAllBtn.innerHTML = originalText;
    copyAllBtn.disabled = false;
  }, 1500);
};

// Helper function to apply inline styles for Naver Blog
function applyInlineStyles(clone: HTMLElement) {
  // H1
  clone.querySelectorAll('h1').forEach(el => {
    (el as HTMLElement).style.fontFamily = 'Nanum Gothic, sans-serif';
    (el as HTMLElement).style.backgroundColor = 'transparent';
    (el as HTMLElement).style.fontSize = '2.6rem';
    (el as HTMLElement).style.fontWeight = '900';
    (el as HTMLElement).style.color = '#111827';
    (el as HTMLElement).style.marginBottom = '2rem';
    (el as HTMLElement).style.paddingBottom = '1rem';
    (el as HTMLElement).style.borderBottom = '3px solid #E5E7EB';
    (el as HTMLElement).style.lineHeight = '1.35';
    (el as HTMLElement).style.textAlign = 'left';
  });

  // H2
  clone.querySelectorAll('h2').forEach(el => {
    (el as HTMLElement).style.fontFamily = 'Nanum Gothic, sans-serif';
    (el as HTMLElement).style.backgroundColor = 'transparent';
    (el as HTMLElement).style.fontSize = '19px';
    (el as HTMLElement).style.fontWeight = '800';
    (el as HTMLElement).style.color = '#1f2937';
    (el as HTMLElement).style.marginTop = '3rem';
    (el as HTMLElement).style.marginBottom = '1.5rem';
    (el as HTMLElement).style.borderLeft = '6px solid #03C75A';
    (el as HTMLElement).style.backgroundColor = '#F0FDF4';
    (el as HTMLElement).style.padding = '1rem 1.5rem';
    (el as HTMLElement).style.borderRadius = '0 12px 12px 0';
  });

  // H3
  clone.querySelectorAll('h3').forEach(el => {
    (el as HTMLElement).style.fontFamily = 'Nanum Gothic, sans-serif';
    (el as HTMLElement).style.backgroundColor = 'transparent';
    (el as HTMLElement).style.fontSize = '15px';
    (el as HTMLElement).style.fontWeight = '700';
    (el as HTMLElement).style.color = '#111827';
    (el as HTMLElement).style.marginTop = '3rem';
    (el as HTMLElement).style.marginBottom = '1.5rem';
    (el as HTMLElement).style.borderLeft = '4px solid #CBD5E1';
    (el as HTMLElement).style.paddingLeft = '1rem';
  });

  // Bold (Highlight)
  clone.querySelectorAll('b').forEach(el => {
    (el as HTMLElement).style.fontWeight = '700';
    (el as HTMLElement).style.background = 'linear-gradient(to top, #FFEF00 35%, transparent 35%)';
    (el as HTMLElement).style.padding = '0 2px';
    (el as HTMLElement).style.color = '#000';
  });

  // Blockquote
  clone.querySelectorAll('blockquote').forEach(el => {
    (el as HTMLElement).style.fontFamily = 'Nanum Myeongjo, serif';
    (el as HTMLElement).style.margin = '4rem 0';
    (el as HTMLElement).style.padding = '3rem 2rem';
    (el as HTMLElement).style.border = 'none';
    (el as HTMLElement).style.background = 'transparent';
    (el as HTMLElement).style.textAlign = 'center';

    el.querySelectorAll('p').forEach(p => {
      (p as HTMLElement).style.fontFamily = 'Nanum Myeongjo, serif';
      (p as HTMLElement).style.backgroundColor = 'transparent';
      (p as HTMLElement).style.fontSize = '16px';
      (p as HTMLElement).style.color = '#475569';
      (p as HTMLElement).style.fontStyle = 'italic';
      (p as HTMLElement).style.lineHeight = '1.8';
    });
  });

  // P (General Body Text)
  clone.querySelectorAll('p:not(blockquote p)').forEach(el => {
    (el as HTMLElement).style.fontFamily = 'Nanum Gothic, sans-serif';
    (el as HTMLElement).style.backgroundColor = 'transparent';
    (el as HTMLElement).style.fontSize = '13px';
    (el as HTMLElement).style.color = '#334155';
    (el as HTMLElement).style.lineHeight = '1.8';
    (el as HTMLElement).style.marginBottom = '2rem';
  });
}

// Clear posts button handler
const clearPostsBtn = document.getElementById('clear-posts-btn');
clearPostsBtn?.addEventListener('click', () => {
  (window as any).generatedBlogPosts = [];
  accumulatedHtml = '';
  editorCanvas.innerHTML = '';

  if (messageWindow) {
    messageWindow.innerHTML = '<div class="text-center py-8 text-gray-300 text-xs"><p>작업 대기 중...</p></div>';
    isMessageWindowInitialized = false;
  }

  addLog('clear', 'System', '모든 기록이 초기화되었습니다.', 'info');
});



runManualBtn.onclick = async () => {
  const title = manualTitleInput.value.trim();
  const url = manualUrlInput.value.trim();
  if (!title) return;

  setButtonLoading(runManualBtn, true, "원고 생성 중...");
  setGlobalStatus(true, "원고 생성 중...");

  try {
    const articleData = await generateArticle(title, "", url);
    await addToAccumulatedDoc(title, articleData);
  } catch (e: any) {
    addLog("err", "오류", e.message, 'error');
  } finally {
    setButtonLoading(runManualBtn, false);
    setGlobalStatus(false);
  }
};

runAutomationBtn.onclick = async () => {
  // Determine active tab/canvas and corresponding data
  let activeCanvas: HTMLElement | null = null;
  let activeItems: any[] = [];

  if (googleCanvas && !googleCanvas.classList.contains('hidden')) {
    activeCanvas = googleCanvas;
    activeItems = (window as any).googleItems || [];
  } else if (naverCanvas && !naverCanvas.classList.contains('hidden')) {
    activeCanvas = naverCanvas;
    activeItems = (window as any).naverItems || [];
  } else if (newsCanvas && !newsCanvas.classList.contains('hidden')) {
    activeCanvas = newsCanvas;
    activeItems = (window as any).scraperItems || [];
  }

  // Check for selected news items in ACTIVE canvas only
  const selectedCheckboxes = activeCanvas ? activeCanvas.querySelectorAll('.news-checkbox:checked') as NodeListOf<HTMLInputElement> : [] as unknown as NodeListOf<HTMLInputElement>;

  // Fallback: If no active logic, try legacy scrapedNewsItems (but this is risky with multiple tabs)
  // const scrapedItems = (window as any).scrapedNewsItems || []; 

  // If items are selected in canvas, use those
  if (selectedCheckboxes.length > 0 && activeItems.length > 0) {
    const selectedItems = Array.from(selectedCheckboxes).map(cb => {
      const itemId = parseInt(cb.getAttribute('data-item-id') || '0');
      return activeItems[itemId];
    }).filter(Boolean);

    if (selectedItems.length === 0) {
      addLog('err', 'Error', 'No valid items selected from active tab', 'error');
      return;
    }

    setButtonLoading(runAutomationBtn, true, "블로그 생성중...");
    statusContainer.innerHTML = '';
    addLog('blog', 'Blog Generator', `Generating blog content for ${selectedItems.length} selected items...`, 'success');

    try {
      for (let item of selectedItems) {
        setGlobalStatus(true, `📝 글 생성 중: ${item.title.substring(0, 30)}...`);
        const articleData = await generateArticle(item.title, item.content, item.link);
        await addToAccumulatedDoc(item.title, articleData);
        addLog('blog-ok', 'Blog', `✅ Generated: ${item.title.substring(0, 40)}...`, 'success');
      }
      addLog('blog-done', 'Blog Generator', `✅ ${selectedItems.length} blog posts generated!`, 'success');
    } catch (e: any) {
      addLog('err', 'Error', e.message, 'error');
    } finally {
      setButtonLoading(runAutomationBtn, false);
      setGlobalStatus(false);
    }
    return;
  }

  // Note: The fallback is for fetching from a sheet that was already saved
  // This is less common now that we have direct canvas selection
  addLog('info', 'Info', '캔버스에서 뉴스를 선택해주세요. 뉴스 검색 후 체크박스를 선택하세요.', 'error');
};

async function fetchSheetData(url: string, name: string) {
  const id = extractIdFromUrl(url);
  const fetchUrl = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(name)}`;
  const res = await fetch(fetchUrl);
  const text = await res.text();
  const json = JSON.parse(text.substring(47, text.length - 2));
  return json.table.rows.map((r: any, idx: number) => ({
    checked: r.c[1]?.v === true || r.c[1]?.v === 'TRUE',
    title: r.c[3]?.v || '',
    content: r.c[4]?.v || '',
    link: r.c[5]?.v || ''
  })).filter((r: any) => r.checked);
}

let lastFileNameTime = "";
let fileSequenceCount = 0;

function downloadImage(dataUrl: string) {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Fill white background for transparency handling
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      const jpgUrl = canvas.toDataURL('image/jpeg', 0.9);

      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      const timeStr = `${dd}-${mm}-${ss}`;

      let fileName = "";

      if (timeStr === lastFileNameTime) {
        fileSequenceCount++;
        fileName = `${timeStr}_${fileSequenceCount}.jpg`;
      } else {
        lastFileNameTime = timeStr;
        fileSequenceCount = 0;
        fileName = `${timeStr}.jpg`;
      }

      const link = document.createElement('a');
      link.href = jpgUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };
  img.src = dataUrl;
}

initPersistence();

// --- Automation Logic & Settings ---
const settingsTriggerBtn = document.getElementById('settings-trigger-btn') as HTMLButtonElement;
const closeSettingsBtn = document.getElementById('close-settings-btn') as HTMLButtonElement;
const settingsModal = document.getElementById('settings-modal') as HTMLElement;
// const manualTriggerBtn = document.getElementById('manual-trigger-btn') as HTMLButtonElement; // REMOVED
const resetSitesBtn = document.getElementById('reset-sites-btn') as HTMLButtonElement;
const siteListContainer = document.getElementById('site-list-container') as HTMLElement;
const newSiteName = document.getElementById('new-site-name') as HTMLInputElement;
const newSiteUrl = document.getElementById('new-site-url') as HTMLInputElement;
const addSiteBtn = document.getElementById('add-site-btn') as HTMLButtonElement;
// Results Modal Elements
const resultsModal = document.getElementById('results-modal') as HTMLElement;
const resultsList = document.getElementById('results-list') as HTMLElement;
const closeResultsBtn = document.getElementById('close-results-btn') as HTMLButtonElement;
const insertResultsBtn = document.getElementById('insert-results-btn') as HTMLButtonElement;
const resultsMeta = document.getElementById('results-meta') as HTMLElement;

// const autoTimeHour = document.getElementById('auto-time-hour') as HTMLSelectElement;
// const autoTimeMinute = document.getElementById('auto-time-minute') as HTMLSelectElement;
const autoSitesInput = document.getElementById('auto-sites-input') as HTMLTextAreaElement; // Changed to Textarea
const autoKeywordInput = document.getElementById('auto-keyword-input') as HTMLInputElement;
// const autoWebhookInput = document.getElementById('auto-webhook-input') as HTMLInputElement;
// const autoSheetNameSaveInput = document.getElementById('auto-sheet-name-save-input') as HTMLInputElement;
// const toggleAutomationBtn = document.getElementById('toggle-automation-btn') as HTMLButtonElement;
const autoStatusText = document.getElementById('auto-status-text') as HTMLElement;

// Default RSS List
const DEFAULT_RSS_SITES = `TechCrunch https://techcrunch.com/rss
Wired https://www.wired.com/feed/rss
ZDNet Korea https://www.zdnet.co.kr/feed/
IT World Korea https://www.itworld.co.kr/rss/
MIT Technology Review https://www.technologyreview.com/feed/
AI News https://www.artificialintelligence-news.com/feed/
Google AI Blog https://blog.research.google/feeds/posts/default?alt=rss
Hacker News https://news.ycombinator.com/rss
DeepMind Blog https://deepmind.com/blog/rss.xml
Engadget https://www.engadget.com/rss.xml
Google AI Blog https://googleaiblog.blogspot.com/atom.xml
Machine Intelligence Research Institute » Blog https://feeds.feedburner.com/miriblog
Artificial Intelligence (Reddit) https://www.reddit.com/r/artificial/.rss
artificial intelligence - Google News https://news.google.com/news/rss/search/section/q/artificial%20intelligence/artificial%20intelligence?hl=en&gl=US
Artificial intelligence (AI) | The Guardian https://www.guardian.co.uk/technology/artificialintelligenceai/rss`;

// Reusable translate handler function for all search types
function attachTranslateHandler(btnId: string = 'translate-news-btn', itemsSource: any[] | null = null, containerPrefix: string = 'news') {
  const translateBtn = document.getElementById(btnId);
  if (!translateBtn) return;

  // Clone to remove old listeners
  const newBtn = translateBtn.cloneNode(true) as HTMLElement;
  translateBtn.parentNode?.replaceChild(newBtn, translateBtn);

  newBtn.addEventListener('click', async () => {
    // Determine active items
    const items = itemsSource || (window as any).scrapedNewsItems || [];

    if (items.length === 0) {
      alert('번역할 뉴스가 없습니다.');
      return;
    }

    newBtn.innerHTML = '⏳ 번역 중...';
    (newBtn as HTMLButtonElement).disabled = true;

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Only translate title/content, keep others
      const prompt = `
        Translate the following news items to Korean. Keep everything else.
        Return STRICT JSON ONLY, no markdown.
        Schema: { "translations": [{ "index": index, "title": "...", "content": "..." }] }
        
        Items to translate (only title/content needed):
        ${JSON.stringify(items.map((i: any, idx: number) => ({ index: idx, title: i.title, content: i.content })))}
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: { parts: [{ text: prompt }] }
      });

      const text = response.text || "";
      const startIdx = text.indexOf('{');
      const endIdx = text.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) {
        const data = JSON.parse(text.substring(startIdx, endIdx + 1));

        // Update DOM
        // Need to know WHICH properties to update. Using prefix might help if we scoped selectors
        // But currently news-item data-item-id is global index often. 
        // Actually, with separated tabs, data-item-id will be 0-based index relative to THAT list.
        // So we need to target the SPECIFIC container for this tab.
        // Assuming unique IDs for containers:
        let containerSelector = '#news-results-container';
        if (containerPrefix === 'google') containerSelector = '#google-results-container';
        if (containerPrefix === 'naver') containerSelector = '#naver-results-container';

        const container = document.querySelector(containerSelector);

        data.translations.forEach((trans: any) => {
          const idx = trans.index;
          // Find item within this container only
          const itemEl = container?.querySelector(`.news-item[data-item-id="${idx}"]`);
          if (itemEl) {
            const tEl = itemEl.querySelector('.news-title');
            const cEl = itemEl.querySelector('.news-content');
            if (tEl) tEl.textContent = trans.title;
            if (cEl) cEl.textContent = trans.content;
          }
          // Update data source
          if (items[idx]) {
            items[idx].title = trans.title;
            items[idx].content = trans.content;
          }
        });

        addLog('translate', 'Translation', `${data.translations.length} items translated`, 'success');
        newBtn.innerHTML = '✅ 번역 완료';
      }
    } catch (e: any) {
      addLog('trans-err', 'Error', e.message, 'error');
      newBtn.innerHTML = '❌ 오류';
    }
    setTimeout(() => {
      newBtn.innerHTML = '🌐 번역하기';
      (newBtn as HTMLButtonElement).disabled = false;
    }, 2000);
  });
}
// Default Google Sources (Search Queries)
const DEFAULT_GOOGLE_SOURCES = [
  { name: '과학기술', query: 'science technology Korea' },
  { name: '건강', query: 'health wellness Korea' },
  { name: '경제', query: 'economy business Korea' },
  { name: '시니어', query: 'senior elderly Korea' },
  { name: '여행', query: 'travel tourism Korea' },
  { name: '정치', query: 'politics Korea' }
];

const GOOGLE_SOURCES_KEY = 'google_search_sources';

// Google sources UI elements
const googleSiteListContainer = document.getElementById('google-site-list-container') as HTMLElement;
const newGoogleName = document.getElementById('new-google-name') as HTMLInputElement;
const newGoogleQuery = document.getElementById('new-google-query') as HTMLInputElement;
const addGoogleSiteBtn = document.getElementById('add-google-site-btn') as HTMLButtonElement;
const resetGoogleSitesBtn = document.getElementById('reset-google-sites-btn') as HTMLButtonElement;

// Get Google sources from localStorage or defaults
function getGoogleSources(): { name: string; query: string }[] {
  const saved = localStorage.getItem(GOOGLE_SOURCES_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return [...DEFAULT_GOOGLE_SOURCES];
    }
  }
  return [...DEFAULT_GOOGLE_SOURCES];
}

// Save Google sources to localStorage
function saveGoogleSources(sources: { name: string; query: string }[]) {
  localStorage.setItem(GOOGLE_SOURCES_KEY, JSON.stringify(sources));
}

// Render Google sources list
function renderGoogleSourcesList() {
  if (!googleSiteListContainer) return;

  const sources = getGoogleSources();

  if (sources.length === 0) {
    googleSiteListContainer.innerHTML = '<li class="text-xs text-gray-400 italic p-2">소스가 없습니다. 추가해주세요.</li>';
    return;
  }

  googleSiteListContainer.innerHTML = sources.map((source, idx) => `
    <li class="flex items-center gap-2 bg-white border border-blue-100 rounded-lg p-2 group hover:border-blue-300 transition-colors">
      <span class="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded">G</span>
      <span class="text-xs font-bold text-gray-800 flex-1 truncate">${source.name}</span>
      <span class="text-[10px] text-gray-400 truncate max-w-[150px]" title="${source.query}">${source.query}</span>
      <button class="delete-google-site-btn opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all" data-idx="${idx}">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </li>
  `).join('');

  // Attach delete handlers
  googleSiteListContainer.querySelectorAll('.delete-google-site-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx') || '0');
      const sources = getGoogleSources();
      sources.splice(idx, 1);
      saveGoogleSources(sources);
      renderGoogleSourcesList();
    });
  });
}

// Add Google source handler
if (addGoogleSiteBtn) {
  addGoogleSiteBtn.onclick = () => {
    const name = newGoogleName?.value.trim();
    const query = newGoogleQuery?.value.trim();

    if (!name || !query) {
      alert('소스명과 검색어를 입력해주세요.');
      return;
    }

    const sources = getGoogleSources();
    sources.push({ name, query });
    saveGoogleSources(sources);
    renderGoogleSourcesList();

    // Clear inputs
    if (newGoogleName) newGoogleName.value = '';
    if (newGoogleQuery) newGoogleQuery.value = '';
  };
}

// Reset Google sources to defaults
if (resetGoogleSitesBtn) {
  resetGoogleSitesBtn.onclick = () => {
    if (confirm('Google 검색 소스를 기본값으로 복원하시겠습니까?')) {
      saveGoogleSources([...DEFAULT_GOOGLE_SOURCES]);
      renderGoogleSourcesList();
    }
  };
}

// Initialize Google sources list on load
renderGoogleSourcesList();
restoreAppState();

// Default Naver Sources (Korean news)
const DEFAULT_NAVER_SOURCES = [
  { name: '네이버IT뉴스', url: 'https://news.naver.com/section/105', category: 'IT' },
  { name: '네이버경제', url: 'https://news.naver.com/section/101', category: '경제' },
  { name: '네이버건강', url: 'https://health.naver.com', category: '건강' },
  { name: '시니어조선', url: 'https://senior.chosun.com', category: '시니어' },
  { name: '네이버여행', url: 'https://travel.naver.com', category: '여행' },
  { name: '정책브리핑', url: 'https://www.korea.kr', category: '행정' }
];

const NAVER_SOURCES_KEY = 'naver_search_sources';

// Naver sources UI elements
const naverSiteListContainer = document.getElementById('naver-site-list-container') as HTMLElement;
const newNaverName = document.getElementById('new-naver-name') as HTMLInputElement;
const newNaverCategory = document.getElementById('new-naver-category') as HTMLInputElement;
const newNaverUrl = document.getElementById('new-naver-url') as HTMLInputElement;
const addNaverSiteBtn = document.getElementById('add-naver-site-btn') as HTMLButtonElement;
const resetNaverSitesBtn = document.getElementById('reset-naver-sites-btn') as HTMLButtonElement;

// Get Naver sources from localStorage or defaults
function getNaverSources(): { name: string; url: string; category: string }[] {
  const saved = localStorage.getItem(NAVER_SOURCES_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return [...DEFAULT_NAVER_SOURCES];
    }
  }
  return [...DEFAULT_NAVER_SOURCES];
}

// Save Naver sources to localStorage
function saveNaverSources(sources: { name: string; url: string; category: string }[]) {
  localStorage.setItem(NAVER_SOURCES_KEY, JSON.stringify(sources));
}

// Render Naver sources list
function renderNaverSourcesList() {
  if (!naverSiteListContainer) return;

  const sources = getNaverSources();

  if (sources.length === 0) {
    naverSiteListContainer.innerHTML = '<li class="text-xs text-gray-400 italic p-2">소스가 없습니다. 추가해주세요.</li>';
    return;
  }

  naverSiteListContainer.innerHTML = sources.map((source, idx) => `
    <li class="flex items-center gap-2 bg-white border border-green-100 rounded-lg p-2 group hover:border-green-300 transition-colors">
      <span class="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded">${source.category}</span>
      <span class="text-xs font-bold text-gray-800 flex-1 truncate">${source.name}</span>
      <span class="text-[10px] text-gray-400 truncate max-w-[150px]" title="${source.url}">${source.url}</span>
      <button class="delete-naver-site-btn opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all" data-idx="${idx}">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </li>
  `).join('');

  // Attach delete handlers
  naverSiteListContainer.querySelectorAll('.delete-naver-site-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx') || '0');
      const sources = getNaverSources();
      sources.splice(idx, 1);
      saveNaverSources(sources);
      renderNaverSourcesList();
    });
  });
}

// Add Naver source handler
if (addNaverSiteBtn) {
  addNaverSiteBtn.onclick = () => {
    const name = newNaverName?.value.trim();
    const category = newNaverCategory?.value.trim() || '기타';
    const url = newNaverUrl?.value.trim();

    if (!name || !url) {
      alert('사이트명과 URL을 입력해주세요.');
      return;
    }

    const sources = getNaverSources();
    sources.push({ name, url, category });
    saveNaverSources(sources);
    renderNaverSourcesList();

    // Clear inputs
    if (newNaverName) newNaverName.value = '';
    if (newNaverCategory) newNaverCategory.value = '';
    if (newNaverUrl) newNaverUrl.value = '';
  };
}

// Reset Naver sources to defaults
if (resetNaverSitesBtn) {
  resetNaverSitesBtn.onclick = () => {
    if (confirm('기본값으로 복원하시겠습니까?')) {
      saveNaverSources([...DEFAULT_NAVER_SOURCES]);
      renderNaverSourcesList();
    }
  };
}

// Initialize Naver sources list on load
renderNaverSourcesList();

// Modal Logic
if (settingsTriggerBtn && settingsModal) {
  settingsTriggerBtn.onclick = () => settingsModal.classList.remove('hidden');
}
if (closeSettingsBtn && settingsModal) {
  closeSettingsBtn.onclick = () => settingsModal.classList.add('hidden');
}

// Header "뉴스 검색" Button Logic
const searchNewsBtn = document.getElementById('search-news-btn') as HTMLButtonElement;
if (searchNewsBtn) {
  searchNewsBtn.onclick = async () => {
    setButtonLoading(searchNewsBtn, true, "검색중...");
    await runScraper();
    setButtonLoading(searchNewsBtn, false);
  };
}

// Header "Google 검색" Button Logic
const googleSearchBtn = document.getElementById('google-search-btn') as HTMLButtonElement;
if (googleSearchBtn) {
  googleSearchBtn.onclick = async () => {
    setButtonLoading(googleSearchBtn, true, "Google 검색중...");
    await runGoogleSearch();
    setButtonLoading(googleSearchBtn, false);
  };
}

// Google Search Function - uses Gemini with Google Search grounding
async function runGoogleSearch(autoSwitchTab: boolean = true) {
  const keywordInput = document.getElementById('auto-keyword-input') as HTMLInputElement;
  const autoStatusText = document.getElementById('auto-status-text') as HTMLElement;
  let keyword = keywordInput?.value.trim() || '';

  // Get dynamic Google sources
  const categories = getGoogleSources();

  if (categories.length === 0) {
    addLog('google-err', 'Error', 'Google 검색 소스가 없습니다. 설정에서 추가해주세요.', 'error');
    return;
  }

  const searchLabel = keyword ? `"${keyword}"` : '한국 인기 뉴스';

  if (autoStatusText) {
    autoStatusText.textContent = `🔍 Google 뉴스 검색: ${searchLabel}...`;
  }
  addLog('google', 'Google News', `Searching ${categories.length} Korean categories for ${searchLabel}...`, 'success');

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const allItems: { site: string; title: string; content: string; link: string; date: string; category: string }[] = [];

  // Switch to google tab and create container
  if (autoSwitchTab) switchToTab('google');

  let containerEl: HTMLElement | null = null;

  if (googleCanvas) {
    const containerHTML = `
      <div id="google-results-container" style="border: 2px solid #4285f4; border-radius: 16px; padding: 24px; margin-bottom: 24px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
          <h2 style="font-size: 1.5rem; font-weight: 900; color: #1e40af; display: flex; align-items: center; gap: 8px; margin: 0;">
            <span style="background: linear-gradient(135deg, #4285f4, #ea4335, #fbbc04, #34a853); color: white; padding: 4px 10px; border-radius: 8px; font-size: 1rem;">G</span>
            Google 뉴스 한국 <span style="font-size: 0.875rem; font-weight: 500; color: #60a5fa;">(${searchLabel} · ${new Date().toLocaleDateString('ko-KR')})</span>
          </h2>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button id="select-all-google-btn" style="padding: 8px 12px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.75rem; font-weight: 600; cursor: pointer;">☑️ 전체 선택</button>
            <button id="deselect-all-google-btn" style="padding: 8px 12px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.75rem; font-weight: 600; cursor: pointer;">⬜ 선택 해제</button>
            <button id="translate-google-btn" style="padding: 8px 16px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 700; cursor: pointer;">🌐 번역하기</button>
          </div>
        </div>
        <div id="google-items-container"></div>
      </div>
    `;
    googleCanvas.innerHTML = containerHTML;
    containerEl = document.getElementById('google-items-container');

    // Attach listeners immediately (using delegation for container, and direct for buttons)
    const selectAllBtn = document.getElementById('select-all-google-btn');
    const deselectAllBtn = document.getElementById('deselect-all-google-btn');

    selectAllBtn?.addEventListener('click', () => {
      const checkboxes = document.querySelectorAll('#google-items-container .news-checkbox') as NodeListOf<HTMLInputElement>;
      checkboxes.forEach(cb => {
        cb.checked = true;
        const parent = cb.closest('.news-item') as HTMLElement;
        if (parent) parent.style.borderColor = '#4285f4';
      });
    });

    deselectAllBtn?.addEventListener('click', () => {
      const checkboxes = document.querySelectorAll('#google-items-container .news-checkbox') as NodeListOf<HTMLInputElement>;
      checkboxes.forEach(cb => {
        cb.checked = false;
        const parent = cb.closest('.news-item') as HTMLElement;
        if (parent) parent.style.borderColor = '#bfdbfe';
      });
    });

    // Delegated listener for checkbox changes
    containerEl?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target && target.classList.contains('news-checkbox')) {
        const parent = target.closest('.news-item') as HTMLElement;
        if (parent) parent.style.borderColor = target.checked ? '#4285f4' : '#bfdbfe';
      }
    });

    // Attach translate button handler
    attachTranslateHandler('translate-google-btn', allItems, 'google');
  }

  let globalItemIndex = 0;

  // Sequential search per category with REAL-TIME DOM APPEND
  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    if (autoStatusText) {
      autoStatusText.textContent = `📡 검색 중 ${i + 1}/${categories.length}: ${category.name}...`;
    }

    try {
      const searchTopic = keyword ? `${keyword} ${category.query}` : `${category.query}`;

      const prompt = `
        You are a Korean news data extraction API.
        Search for the 5 LATEST / NEWEST news articles from Google News Korea (news.google.com) about: ${searchTopic}
        
        Category/Source Name: ${category.name}
        
        IMPORTANT CONSTRAINTS:
        - TIME: Articles MUST be published within the LAST 24-48 HOURS.
        - SORT: Descending order by DATE / RECENCY (Newest First). DO NOT sort by popularity.
        - SOURCE: Find articles from reputable Korean news sources (한국 뉴스).
        - CONTENT: Summary should be in Korean (한국어).
        - RETURN: Exactly 5 items.

        Output: STRICT RAW JSON ONLY. No markdown.

        JSON Schema:
        {
            "items": [
                { "title": "한국어 제목", "date": "YYYY-MM-DD", "content": "한국어 요약 1-2문장", "link": "https://...", "source": "뉴스 출처명", "hits": "조회수 (예: 1만회)" }
            ]
        }
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: { parts: [{ text: prompt }] },
        config: { tools: [{ googleSearch: {} }] }
      });

      const text = response.text || "";
      const startIndex = text.indexOf('{');
      const endIndex = text.lastIndexOf('}');

      if (startIndex !== -1 && endIndex !== -1) {
        const jsonStr = text.substring(startIndex, endIndex + 1);
        const data = JSON.parse(jsonStr);

        const currentItems: any[] = [];
        // Store items
        data.items.forEach((item: any) => {
          const newItem = {
            site: item.source || category.name,
            title: item.title,
            content: item.content,
            link: item.link,
            date: item.date || 'N/A',
            category: category.name
          };
          allItems.push(newItem);
          currentItems.push(newItem);
        });

        // Real-time display: Append Child
        if (containerEl && currentItems.length > 0) {
          const sectionDiv = document.createElement('div');
          sectionDiv.className = 'site-section';
          sectionDiv.style.marginBottom = '20px';

          sectionDiv.innerHTML = `
             <h3 style="font-size: 1rem; font-weight: 800; color: #1e40af; margin-bottom: 12px; padding-bottom: 4px; border-bottom: 2px solid #93c5fd; display: flex; align-items: center; gap: 8px;">
               <span style="background: #dbeafe; padding: 2px 8px; border-radius: 6px; font-size: 0.75rem; color: #1d4ed8;">${category.name}</span>
             </h3>
             ${currentItems.map((item: any) => {
            const idx = globalItemIndex++;
            return `
                   <div class="news-item" data-item-id="${idx}" style="display: flex; gap: 12px; align-items: flex-start; padding: 12px 16px; margin: 8px 0 12px 0; background-color: #ffffff; border-radius: 8px; border: 2px solid #bfdbfe; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: all 0.2s;">
                     <input type="checkbox" class="news-checkbox" data-item-id="${idx}" style="width: 18px; height: 18px; margin-top: 4px; cursor: pointer; accent-color: #4285f4;">
                     <div style="flex: 1;">
                       <p class="news-title" style="font-size: 1rem; font-weight: 700; color: #111827; margin-bottom: 4px;">${item.title}</p>
                       <p style="font-size: 0.7rem; color: #9ca3af; margin-bottom: 6px;">📅 ${item.date || 'N/A'} · ${item.source || ''}</p>
                       <p class="news-content" style="font-size: 0.875rem; color: #4b5563; line-height: 1.6; margin-bottom: 8px;">${item.content}</p>
                       <a href="${item.link}" target="_blank" style="font-size: 0.7rem; color: #4285f4; text-decoration: none; font-weight: 500; word-break: break-all;">🔗 ${item.link}</a>
                     </div>
                   </div>
                `;
          }).join('')}
          `;
          containerEl.appendChild(sectionDiv);
        }

        addLog(`google-${i}`, category.name, `Found ${data.items.length} items`, 'success');
      }
    } catch (e: any) {
      addLog(`google-${i}-err`, category.name, `Error: ${e.message}`, 'error');
    }
  }

  // Store globally for blog generation
  (window as any).googleItems = allItems;
  (window as any).scrapedNewsItems = allItems; // Update shared for blog generation context

  if (autoStatusText) {
    autoStatusText.textContent = `✅ Google 검색 완료: ${allItems.length}개 발견!`;
  }
  addLog('google-done', 'Google Search', `Total: ${allItems.length} items!`, 'success');

  // Save state
  saveAppState();
}
// Header "전체 검색" Button Logic
const globalSearchBtn = document.getElementById('global-search-btn') as HTMLButtonElement;
if (globalSearchBtn) {
  globalSearchBtn.onclick = async () => {
    setButtonLoading(globalSearchBtn, true, "전체 검색 중...");
    setGlobalStatus(true, "🚀 전체 검색 시작: 뉴스, Google, 네이버 검색을 순차적으로 실행합니다...");

    try {
      // 1. Run Scraper (News Tab) - Silent
      addLog('global-start', 'Global Search', 'Starting Step 1: Auto-Scraper', 'info');
      await runScraper(false);

      // 2. Run Google Search - Silent
      addLog('global-step2', 'Global Search', 'Starting Step 2: Google Search', 'info');
      await runGoogleSearch(false);

      // 3. Run Naver Search - Silent
      addLog('global-step3', 'Global Search', 'Starting Step 3: Naver Search', 'info');
      await runNaverSearch(false);

      addLog('global-done', 'Global Search', '✅ 모든 검색이 완료되었습니다! 각 탭을 눌러 결과를 확인하세요.', 'success');
      setGlobalStatus(false);

      // Optional: Switch to the first tab (News) or leave it to user? 
      // User said "탭을 선택하여 확인 할 수 있도록 해 줘", implying manual selection.
      // But maybe showing one is nice. Let's show News tab as it's the first one.
      switchToTab('news');

    } catch (e: any) {
      addLog('global-err', 'Error', `Global Search Failed: ${e.message}`, 'error');
    } finally {
      setButtonLoading(globalSearchBtn, false);
      setGlobalStatus(false);
    }
  };
}

// Header "네이버 검색" Button Logic
const naverSearchBtn = document.getElementById('naver-search-btn') as HTMLButtonElement;
if (naverSearchBtn) {
  naverSearchBtn.onclick = async () => {
    setButtonLoading(naverSearchBtn, true, "네이버 검색중...");
    await runNaverSearch();
    setButtonLoading(naverSearchBtn, false);
  };
}

// Naver Search Function - searches Korean news sources
async function runNaverSearch(autoSwitchTab: boolean = true) {
  // Get keyword from settings (optional now)
  const keywordInput = document.getElementById('auto-keyword-input') as HTMLInputElement;
  const autoStatusText = document.getElementById('auto-status-text') as HTMLElement;
  let keyword = keywordInput?.value.trim() || '';

  // Get Korean news sources from settings
  const naverSources = getNaverSources();

  if (naverSources.length === 0) {
    addLog('naver-err', 'Error', '네이버 검색 소스가 없습니다. 설정에서 추가해주세요.', 'error');
    return;
  }

  // Status message based on whether keyword is provided
  const searchLabel = keyword ? `"${keyword}"` : '인기 뉴스';
  if (autoStatusText) {
    autoStatusText.textContent = `🔍 네이버 검색: ${searchLabel}...`;
  }
  addLog('naver', 'Naver Search', `Searching ${naverSources.length} Korean sources for ${searchLabel}...`, 'success');

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const allItems: { site: string; title: string; content: string; link: string; date: string; category: string }[] = [];

  // Switch to naver tab and create container
  if (autoSwitchTab) switchToTab('naver');

  let containerEl: HTMLElement | null = null;
  if (naverCanvas) {
    const containerHTML = `
      <div id="naver-results-container" style="border: 2px solid #22c55e; border-radius: 16px; padding: 24px; margin-bottom: 24px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
          <h2 style="font-size: 1.5rem; font-weight: 900; color: #166534; display: flex; align-items: center; gap: 8px; margin: 0;">
            <span style="background: #22c55e; color: white; padding: 4px 10px; border-radius: 8px; font-size: 1rem;">N</span>
            네이버 검색 결과 <span style="font-size: 0.875rem; font-weight: 500; color: #4ade80;">(${searchLabel} · ${new Date().toLocaleDateString('ko-KR')})</span>
          </h2>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button id="select-all-naver-btn" style="padding: 8px 12px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.75rem; font-weight: 600; cursor: pointer;">☑️ 전체 선택</button>
            <button id="deselect-all-naver-btn" style="padding: 8px 12px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.75rem; font-weight: 600; cursor: pointer;">⬜ 선택 해제</button>
            <button id="translate-naver-btn" style="padding: 8px 16px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 700; cursor: pointer;">🌐 번역하기</button>
          </div>
        </div>
        <div id="naver-items-container"></div>
      </div>
    `;
    naverCanvas.innerHTML = containerHTML;
    containerEl = document.getElementById('naver-items-container');

    // Attach listeners immediately
    const selectAllBtn = document.getElementById('select-all-naver-btn');
    const deselectAllBtn = document.getElementById('deselect-all-naver-btn');

    selectAllBtn?.addEventListener('click', () => {
      const checkboxes = document.querySelectorAll('#naver-items-container .news-checkbox') as NodeListOf<HTMLInputElement>;
      checkboxes.forEach(cb => {
        cb.checked = true;
        const parent = cb.closest('.news-item') as HTMLElement;
        if (parent) parent.style.borderColor = '#22c55e';
      });
    });

    deselectAllBtn?.addEventListener('click', () => {
      const checkboxes = document.querySelectorAll('#naver-items-container .news-checkbox') as NodeListOf<HTMLInputElement>;
      checkboxes.forEach(cb => {
        cb.checked = false;
        const parent = cb.closest('.news-item') as HTMLElement;
        if (parent) parent.style.borderColor = '#bbf7d0';
      });
    });

    // Delegated listener
    containerEl?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target && target.classList.contains('news-checkbox')) {
        const parent = target.closest('.news-item') as HTMLElement;
        if (parent) parent.style.borderColor = target.checked ? '#22c55e' : '#bbf7d0';
      }
    });

    attachTranslateHandler('translate-naver-btn', allItems, 'naver');
  }

  let globalItemIndex = 0;

  // Sequential search per source with REAL-TIME DOM APPEND
  for (let i = 0; i < naverSources.length; i++) {
    const source = naverSources[i];
    if (autoStatusText) {
      autoStatusText.textContent = `📡 검색 중 ${i + 1}/${naverSources.length}: ${source.name}...`;
    }

    try {
      // Build search context: use keyword if provided, otherwise use category
      const searchContext = keyword ? keyword : source.category;

      const prompt = `
        You are a Korean news data extraction API.
        Search for the 5 LATEST / NEWEST news articles from this Korean source:
        
        Source: ${source.name} (${source.url})
        Category: ${source.category}
        ${keyword ? `Search Topic: "${keyword}"` : `Search for: Recent news in ${source.category} category`}

        IMPORTANT CONSTRAINTS:
        - TIME: Articles MUST be published within the LAST 24-48 HOURS.
        - SORT: Descending order by DATE / RECENCY (Newest First). DO NOT sort by popularity.
        - SOURCE: Find articles from this specific source.
        - CONTENT: Summary should be in Korean.
        - RETURN: Exactly 5 items.

        Output: STRICT RAW JSON ONLY. No markdown.

        JSON Schema:
        {
            "items": [
                { "title": "제목", "date": "YYYY-MM-DD", "content": "1-2문장 요약", "link": "https://...", "hits": "조회수 또는 인기도 (예: 1만회, 인기)" }
            ]
        }
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: { parts: [{ text: prompt }] },
        config: { tools: [{ googleSearch: {} }] }
      });

      const text = response.text || "";
      const startIndex = text.indexOf('{');
      const endIndex = text.lastIndexOf('}');

      if (startIndex !== -1 && endIndex !== -1) {
        const jsonStr = text.substring(startIndex, endIndex + 1);
        const data = JSON.parse(jsonStr);

        const currentItems: any[] = [];
        // Store items
        data.items.forEach((item: any) => {
          const newItem = {
            site: source.name,
            title: item.title,
            content: item.content,
            link: item.link,
            date: item.date || 'N/A',
            category: source.category
          };
          allItems.push(newItem);
          currentItems.push(newItem);
        });

        // Real-time display: Append Child
        if (containerEl && currentItems.length > 0) {
          const sectionDiv = document.createElement('div');
          sectionDiv.className = 'site-section';
          sectionDiv.style.marginBottom = '20px';

          sectionDiv.innerHTML = `
             <h3 style="font-size: 1rem; font-weight: 800; color: #166534; margin-bottom: 12px; padding-bottom: 4px; border-bottom: 2px solid #86efac; display: flex; align-items: center; gap: 8px;">
               <span style="background: #dcfce7; padding: 2px 8px; border-radius: 6px; font-size: 0.75rem; color: #15803d;">${source.category}</span>
               ${source.name}
             </h3>
             ${currentItems.map((item: any) => {
            const idx = globalItemIndex++;
            return `
                   <div class="news-item" data-item-id="${idx}" style="display: flex; gap: 12px; align-items: flex-start; padding: 12px 16px; margin: 8px 0 12px 0; background-color: #ffffff; border-radius: 8px; border: 2px solid #bbf7d0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: all 0.2s;">
                     <input type="checkbox" class="news-checkbox" data-item-id="${idx}" style="width: 18px; height: 18px; margin-top: 4px; cursor: pointer; accent-color: #22c55e;">
                     <div style="flex: 1;">
                       <p class="news-title" style="font-size: 1rem; font-weight: 700; color: #111827; margin-bottom: 4px;">${item.title}</p>
                       <p style="font-size: 0.7rem; color: #9ca3af; margin-bottom: 6px;">📅 ${item.date || 'N/A'}</p>
                       <p class="news-content" style="font-size: 0.875rem; color: #4b5563; line-height: 1.6; margin-bottom: 8px;">${item.content}</p>
                       <a href="${item.link}" target="_blank" style="font-size: 0.7rem; color: #16a34a; text-decoration: none; font-weight: 500; word-break: break-all;">🔗 ${item.link}</a>
                     </div>
                   </div>
                `;
          }).join('')}
          `;
          containerEl.appendChild(sectionDiv);
        }

        addLog(`naver-${i}`, source.name, `Found ${data.items.length} items`, 'success');
      }
    } catch (e: any) {
      addLog(`naver-${i}-err`, source.name, `Error: ${e.message}`, 'error');
    }
  }

  // Store globally for blog generation
  (window as any).naverItems = allItems;
  (window as any).scrapedNewsItems = allItems;

  if (autoStatusText) {
    autoStatusText.textContent = `✅ 네이버 검색 완료: ${allItems.length}개 발견!`;
  }
  addLog('naver-done', 'Naver Search', `Total: ${allItems.length} items from Korean sources!`, 'success');

  // Save state
  saveAppState();
}

if (closeResultsBtn && resultsModal) {
  closeResultsBtn.onclick = () => resultsModal.classList.add('hidden');
}

if (insertResultsBtn && resultsModal) {
  insertResultsBtn.onclick = () => {
    // Find current results (we can parse from DOM or store in var, parsing DOM is stateless/easy)
    const items = Array.from(resultsList.children).map((card: any) => {
      const title = card.querySelector('h4').innerText;
      const content = card.querySelector('p').innerText;
      const link = card.querySelector('a').href;
      return { title, content, link };
    });

    // Append to Editor
    const editorEl = document.getElementById('editor') as HTMLElement;
    if (editorEl) {
      const formattedHTML = items.map(item => `
              <h2 style="font-size: 1.875rem; font-weight: 800; color: #111827; margin-bottom: 1.5rem; letter-spacing: -0.025em; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem;">${item.title}</h2>
              <blockquote style="font-family: 'Nanum Myeongjo', serif; border-left: 4px solid #4f46e5; padding-left: 1rem; margin-left: 0; color: #4b5563; font-style: italic; background-color: #f9fafb; padding: 1rem; border-radius: 0 0.5rem 0.5rem 0;">
                  <p style="font-size: 1.125rem; line-height: 1.8; margin-bottom: 0.5rem;">${item.content}</p>
                  <a href="${item.link}" target="_blank" style="font-size: 0.875rem; color: #4f46e5; text-decoration: none; font-weight: 600;">🔗 Read Source</a>
              </blockquote>
              <br/>
          `).join('');

      editorEl.innerHTML += formattedHTML;
      addLog('sys', 'System', 'Inserted news items into editor', 'success');
    }

    resultsModal.classList.add('hidden');
  };
}

// Site List Management Logic
function renderSiteList() {
  if (!siteListContainer || !autoSitesInput) return;
  siteListContainer.innerHTML = '';
  const lines = autoSitesInput.value.split('\n').filter(l => l.trim() !== "");

  lines.forEach((line, idx) => {
    const parts = line.match(/^(.+?)\s+(https?:\/\/.+)$/);
    let name = "Site";
    let url = line.trim();
    if (parts) {
      name = parts[1].trim();
      url = parts[2].trim();
    } else {
      // Try fallback split by space
      const spaceSplit = line.trim().split(' ');
      if (spaceSplit.length > 1 && spaceSplit[spaceSplit.length - 1].startsWith('http')) {
        url = spaceSplit.pop()!;
        name = spaceSplit.join(' ');
      } else {
        // Just URL
        name = url.replace(/https?:\/\/(www\.)?/, '').split('/')[0];
      }
    }

    const li = document.createElement('li');
    li.className = "flex items-center justify-between bg-white border border-gray-100 p-2 rounded-lg text-xs shadow-sm";
    li.innerHTML = `
    <div class="flex flex-col overflow-hidden mr-2">
      <span class="font-bold text-gray-800 truncate">${name}</span>
      <span class="text-[10px] text-gray-400 truncate font-mono">${url}</span>
    </div>
    <button class="delete-site-btn text-gray-400 hover:text-red-500 transition-colors p-1" data-idx="${idx}">
      🚫
    </button>
  `;
    siteListContainer.appendChild(li);

    // Attach delete handler
    const delBtn = li.querySelector('.delete-site-btn') as HTMLButtonElement;
    delBtn.onclick = () => {
      const newLines = [...lines];
      newLines.splice(idx, 1);
      autoSitesInput.value = newLines.join('\n');
      localStorage.setItem(STORAGE_KEYS.AUTO_SITES, autoSitesInput.value);
      renderSiteList();
    };
  });
}

if (addSiteBtn && newSiteName && newSiteUrl && autoSitesInput) {
  addSiteBtn.onclick = () => {
    const name = newSiteName.value.trim();
    const url = newSiteUrl.value.trim();
    if (!name || !url) return alert("Please enter both Name and URL.");

    const newLine = `${name} ${url}`;
    const currentVal = autoSitesInput.value.trim();
    autoSitesInput.value = currentVal ? currentVal + "\n" + newLine : newLine;
    localStorage.setItem(STORAGE_KEYS.AUTO_SITES, autoSitesInput.value);

    newSiteName.value = "";
    newSiteUrl.value = "";
    renderSiteList();
  };
}

if (resetSitesBtn && autoSitesInput) {
  resetSitesBtn.onclick = () => {
    if (confirm("사이트 목록을 기본값으로 초기화하시겠습니까? (현재 변경사항이 사라집니다)")) {
      autoSitesInput.value = DEFAULT_RSS_SITES;
      localStorage.setItem(STORAGE_KEYS.AUTO_SITES, DEFAULT_RSS_SITES);
      renderSiteList();
    }
  };
}

// Persistence & Initialization
function initAutomationSettings() {
  if (autoSitesInput) {
    autoSitesInput.value = localStorage.getItem(STORAGE_KEYS.AUTO_SITES) || DEFAULT_RSS_SITES;
  }
  autoKeywordInput.value = localStorage.getItem(STORAGE_KEYS.AUTO_KEYWORDS) || "";

  // Save on change
  if (autoSitesInput) {
    autoSitesInput.value = localStorage.getItem(STORAGE_KEYS.AUTO_SITES) || DEFAULT_RSS_SITES;
    renderSiteList();
  }
  autoKeywordInput.onchange = () => localStorage.setItem(STORAGE_KEYS.AUTO_KEYWORDS, autoKeywordInput.value);
}

// Call init immediately
initAutomationSettings();

async function runScraper(autoSwitchTab: boolean = true) {
  const sitesRaw = autoSitesInput?.value.trim() || DEFAULT_RSS_SITES;
  const keyword = autoKeywordInput.value || "Trending";

  // Parse sites: each line is "SiteName URL" format
  const siteLines = sitesRaw.split('\n').filter(l => l.trim() !== "");
  const sites = siteLines.map(line => {
    const match = line.match(/^(.+?)\s+(https?:\/\/.+)$/);
    if (match) {
      return { name: match[1].trim(), url: match[2].trim() };
    }
    // Fallback: treat as URL only
    const url = line.trim();
    const name = url.replace(/https?:\/\/(www\.)?/, '').split('/')[0];
    return { name, url };
  });

  if (sites.length === 0) {
    addLog('auto-err', 'Error', 'No sites configured', 'error');
    return;
  }

  if (autoStatusText) {
    autoStatusText.textContent = `🚀 Starting scan of ${sites.length} sites...`;
  }
  addLog('auto', 'Auto-Scraper', `Scanning ${sites.length} sites for "${keyword}"...`, 'success');

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const allItems: { site: string; title: string; content: string; link: string; date: string }[] = [];

  // Create container for real-time updates in NEWS canvas
  let containerEl: HTMLElement | null = null;

  if (newsCanvas) {
    // Switch to news tab
    if (autoSwitchTab) switchToTab('news');

    const containerHTML = `
    <div id="news-results-container" style="border: 2px solid #e5e7eb; border-radius: 16px; padding: 24px; margin-bottom: 24px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
        <h2 style="font-size: 1.5rem; font-weight: 900; color: #1f2937; display: flex; align-items: center; gap: 8px; margin: 0;">
          📰 뉴스 검색 결과 <span style="font-size: 0.875rem; font-weight: 500; color: #6b7280;">(${keyword} · ${new Date().toLocaleDateString('ko-KR')})</span>
        </h2>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button id="select-all-news-btn" style="padding: 8px 12px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.75rem; font-weight: 600; cursor: pointer;">☑️ 전체 선택</button>
          <button id="deselect-all-news-btn" style="padding: 8px 12px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.75rem; font-weight: 600; cursor: pointer;">⬜ 선택 해제</button>
        </div>
      </div>
      <div id="news-items-container"></div>
    </div>
  `;
    newsCanvas.innerHTML = containerHTML;
    containerEl = document.getElementById('news-items-container');

    // Attach listeners immediately
    const selectAllBtn = document.getElementById('select-all-news-btn');
    const deselectAllBtn = document.getElementById('deselect-all-news-btn');

    selectAllBtn?.addEventListener('click', () => {
      const checkboxes = document.querySelectorAll('.news-checkbox') as NodeListOf<HTMLInputElement>;
      checkboxes.forEach(cb => {
        cb.checked = true;
        const parent = cb.closest('.news-item') as HTMLElement;
        if (parent) parent.style.borderColor = '#10b981';
      });
    });

    deselectAllBtn?.addEventListener('click', () => {
      const checkboxes = document.querySelectorAll('.news-checkbox') as NodeListOf<HTMLInputElement>;
      checkboxes.forEach(cb => {
        cb.checked = false;
        const parent = cb.closest('.news-item') as HTMLElement;
        if (parent) parent.style.borderColor = '#e5e7eb';
      });
    });

    // Delegated listener
    containerEl?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target && target.classList.contains('news-checkbox')) {
        const parent = target.closest('.news-item') as HTMLElement;
        if (parent) parent.style.borderColor = target.checked ? '#10b981' : '#e5e7eb';
      }
    });

    // attachTranslateHandler removed as translations are now automatic
  }

  let globalItemIndex = 0;

  // Sequential per-site scraping with REAL-TIME updates
  for (let i = 0; i < sites.length; i++) {
    const site = sites[i];
    if (autoStatusText) {
      autoStatusText.textContent = `📡 Scanning ${i + 1}/${sites.length}: ${site.name}...`;
    }
    addLog(`site-${i}`, 'Scanning', site.name, 'success');

    try {
      const prompt = `
        You are a strict data extraction API.
        Context: Find the 3 LATEST / NEWEST news articles related to "${keyword}" from this SPECIFIC source ONLY:
        
        Source: ${site.name} (${site.url})

        IMPORTANT CONSTRAINTS:
        - TIME: Articles MUST be published within the LAST 24-48 HOURS.
        - SORT: Descending order by DATE / RECENCY (Newest First). DO NOT sort by popularity.
        - SOURCE: Only return articles ACTUALLY FROM this specific source/website.
        - DUPLICATES: Do NOT return generic or duplicate articles.
        - DATE: Each article must include its publish date.

        Instructions:
        1. Search this specific site for "${keyword}" related content.
        2. Extract exactly 3 UNIQUE items: Title, Publish Date, Content (1-2 sentence summary), Link.
        3. TRANSLATE Title and Content to KOREAN (한국어) immediately.
        4. Output: STRICT RAW JSON ONLY. No markdown, no intro text.

        JSON Schema:
        {
            "items": [
                { "title": "...", "date": "YYYY-MM-DD or 날짜 표시", "content": "...", "link": "..." }
            ]
        }
        `;

      // Timeout wrapper for API call
      const generateWithTimeout = async (options: any, ms: number) => {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));
        const apiCall = ai.models.generateContent(options);
        return Promise.race([apiCall, timeout]);
      };

      // 15 seconds timeout per site
      const response: any = await generateWithTimeout({
        model: "gemini-2.0-flash-exp",
        contents: { parts: [{ text: prompt }] },
        config: { tools: [{ googleSearch: {} }] }
      }, 15000);

      const text = response.text || "";
      const startIndex = text.indexOf('{');
      const endIndex = text.lastIndexOf('}');

      if (startIndex !== -1 && endIndex !== -1) {
        const jsonStr = text.substring(startIndex, endIndex + 1);
        const data = JSON.parse(jsonStr);

        const currentItems: any[] = [];
        // Store items
        data.items.forEach((item: any) => {
          const newItem = {
            site: site.name,
            title: item.title,
            content: item.content,
            link: item.link,
            date: item.date || 'N/A'
          };
          allItems.push(newItem);
          currentItems.push(newItem);
        });

        // Real-time display: Append Child
        if (containerEl && currentItems.length > 0) {
          const siteHTML = `
            <div style="margin-bottom: 20px;" class="site-section">
              <h3 style="font-size: 1rem; font-weight: 800; color: #1e40af; margin-bottom: 12px; padding-bottom: 4px; border-bottom: 2px solid #93c5fd; display: flex; align-items: center; gap: 8px;">
                <span style="background: #dbeafe; padding: 2px 8px; border-radius: 6px; font-size: 0.75rem; color: #1d4ed8;">${site.name}</span>
              </h3>
              ${currentItems.map((item: any) => {
            const idx = globalItemIndex++;
            return `
                <div class="news-item" data-item-id="${idx}" style="display: flex; gap: 12px; align-items: flex-start; padding: 12px 16px; margin: 8px 0 12px 0; background-color: #ffffff; border-radius: 8px; border: 2px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: all 0.2s;">
                  <input type="checkbox" class="news-checkbox" data-item-id="${idx}" style="width: 18px; height: 18px; margin-top: 4px; cursor: pointer; accent-color: #10b981;">
                  <div style="flex: 1;">
                    <p class="news-title" style="font-size: 1rem; font-weight: 700; color: #111827; margin-bottom: 4px;">${item.title}</p>
                    <p style="font-size: 0.7rem; color: #9ca3af; margin-bottom: 6px;">📅 ${item.date || 'N/A'}</p>
                    <p class="news-content" style="font-size: 0.875rem; color: #4b5563; line-height: 1.6; margin-bottom: 8px;">${item.content}</p>
                    <a href="${item.link}" target="_blank" style="font-size: 0.7rem; color: #10b981; text-decoration: none; font-weight: 500; word-break: break-all;">🔗 ${item.link}</a>
                  </div>
                </div>
              `;
          }).join('')}
            </div>
          `;

          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = siteHTML;
          while (tempDiv.firstChild) {
            containerEl.appendChild(tempDiv.firstChild);
          }
        }

        addLog(`site-${i}-ok`, site.name, `Found ${data.items.length} items`, 'success');
      }
    } catch (e: any) {
      addLog(`site-${i}-err`, site.name, `Error: ${e.message}`, 'error');
    }
  }

  // Store globally for translation
  (window as any).scraperItems = allItems;
  (window as any).scrapedNewsItems = allItems;

  if (autoStatusText) {
    autoStatusText.textContent = `✅ Found ${allItems.length} total items from ${sites.length} sites`;
  }
  addLog('auto', 'Auto-Scraper', `Total: ${allItems.length} items collected!`, 'success');

  // Save state
  saveAppState();
}
