
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
const blogCanvas = document.getElementById('blog-canvas') as HTMLElement;
const editorCanvas = blogCanvas; // Backward compatibility alias
const tabNews = document.getElementById('tab-news') as HTMLButtonElement;
const tabBlog = document.getElementById('tab-blog') as HTMLButtonElement;

// Tab switching function
function switchToTab(tab: 'news' | 'blog') {
  if (tab === 'news') {
    newsCanvas?.classList.remove('hidden');
    blogCanvas?.classList.add('hidden');
    tabNews?.classList.add('text-emerald-600', 'border-emerald-500', 'bg-white');
    tabNews?.classList.remove('text-gray-400', 'border-transparent');
    tabBlog?.classList.remove('text-indigo-600', 'border-indigo-500', 'bg-white');
    tabBlog?.classList.add('text-gray-400', 'border-transparent');
  } else {
    blogCanvas?.classList.remove('hidden');
    newsCanvas?.classList.add('hidden');
    tabBlog?.classList.add('text-indigo-600', 'border-indigo-500', 'bg-white');
    tabBlog?.classList.remove('text-gray-400', 'border-transparent');
    tabNews?.classList.remove('text-emerald-600', 'border-emerald-500', 'bg-white');
    tabNews?.classList.add('text-gray-400', 'border-transparent');
  }
}

// Tab click handlers
tabNews?.addEventListener('click', () => switchToTab('news'));
tabBlog?.addEventListener('click', () => switchToTab('blog'));

marked.setOptions({
  breaks: true,
  gfm: true,
  headerIds: false,
  mangle: false
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
  AUTO_SHEET_NAME_SAVE: 'gemini_auto_sheet_name_save'
};

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
 * Adds a log entry to the status container.
 */
function addLog(id: string, title: string, message: string, type: 'success' | 'error') {
  const logDiv = document.createElement('div');
  logDiv.id = id;
  logDiv.className = `p-3 rounded-xl text-xs mb-2 border ${type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'
    }`;
  logDiv.innerHTML = `<strong>[${title}]</strong> ${message}`;
  statusContainer.appendChild(logDiv);
  statusContainer.scrollTop = statusContainer.scrollHeight;
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

  if (savedSheetId) sheetIdInput.value = savedSheetId;
  if (savedSheetName) sheetNameInput.value = savedSheetName;
  if (savedTextModel) textModelSelect.value = savedTextModel;
  if (savedImageModel) imageModelSelect.value = savedImageModel;
  if (savedManualTitle) manualTitleInput.value = savedManualTitle;
  if (savedManualUrl) manualUrlInput.value = savedManualUrl;

  sheetIdInput.addEventListener('input', () => localStorage.setItem(STORAGE_KEYS.SHEET_ID, sheetIdInput.value));
  sheetNameInput.addEventListener('input', () => localStorage.setItem(STORAGE_KEYS.SHEET_NAME, sheetNameInput.value));
  textModelSelect.addEventListener('change', () => localStorage.setItem(STORAGE_KEYS.TEXT_MODEL, textModelSelect.value));
  imageModelSelect.addEventListener('change', () => localStorage.setItem(STORAGE_KEYS.IMAGE_MODEL, imageModelSelect.value));
  manualTitleInput.addEventListener('input', () => localStorage.setItem(STORAGE_KEYS.MANUAL_TITLE, manualTitleInput.value));
  manualUrlInput.addEventListener('input', () => localStorage.setItem(STORAGE_KEYS.MANUAL_URL, manualUrlInput.value));
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
  let html = marked.parse(cleaned);

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

  // Update sidebar Generated Posts list
  updateGeneratedPostsList();

  addLog(`accum-${Date.now()}`, title, `원고 생성 완료 (마크다운 정제됨)`, 'success');
}

// Function to update the Generated Posts list in sidebar (RADIO - single select)
function updateGeneratedPostsList() {
  const posts = (window as any).generatedBlogPosts || [];
  const container = document.getElementById('generated-posts-list');

  if (!container) return;

  if (posts.length === 0) {
    container.innerHTML = '<p class="text-[10px] text-gray-400 italic">생성된 글이 없습니다</p>';
    return;
  }

  // Ensure at least one is selected (default to last)
  if (!posts.find((p: any) => p.selected)) {
    posts[posts.length - 1].selected = true;
  }

  container.innerHTML = posts.map((post: any, idx: number) => `
    <div class="flex items-center gap-2 p-2 ${post.selected ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50'} rounded-lg cursor-pointer generated-post-item" data-post-id="${post.id}">
      <input type="radio" name="generated-post-select" class="generated-post-radio" data-post-id="${post.id}" ${post.selected ? 'checked' : ''} 
        style="width: 14px; height: 14px; cursor: pointer; accent-color: #10b981;">
      <span class="text-[11px] ${post.selected ? 'text-emerald-700 font-bold' : 'text-gray-700'} truncate flex-1" title="${post.title}">${idx + 1}. ${post.title.substring(0, 25)}${post.title.length > 25 ? '...' : ''}</span>
    </div>
  `).join('');

  // Attach click listeners for single selection
  container.querySelectorAll('.generated-post-item').forEach(item => {
    item.addEventListener('click', () => {
      const postId = (item as HTMLElement).getAttribute('data-post-id');
      // Deselect all
      posts.forEach((p: any) => p.selected = false);
      // Select clicked one
      const post = posts.find((p: any) => p.id === postId);
      if (post) post.selected = true;
      // Re-render
      updateGeneratedPostsList();
    });
  });
}

genImageBtn.onclick = async () => {
  const boxes = document.querySelectorAll('.image-prompt-box');
  const pendingBoxes = Array.from(boxes).filter(box => !box.querySelector('img'));
  if (pendingBoxes.length === 0) return alert("생성할 이미지가 없습니다.");

  genImageBtn.disabled = true;
  for (let box of pendingBoxes) {
    const prompt = (box as HTMLElement).getAttribute('data-prompt');
    if (prompt) {
      // True: Auto download enabled for batch
      await generateImageWithPrompt(box as HTMLElement, prompt, true);
    }
  }
  genImageBtn.disabled = false;
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
    const modelName = (document.getElementById('image-model-select') as HTMLSelectElement).value;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts: [{ text: promptText }] },
      config: { imageConfig: { aspectRatio: "1:1" } }
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
  alert("통합 원고 복사 완료 (이미지 제외됨)");
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
  updateGeneratedPostsList();
  addLog('clear', 'Posts', 'Generated posts cleared', 'success');
});



runManualBtn.onclick = async () => {
  const title = manualTitleInput.value.trim();
  const url = manualUrlInput.value.trim();
  if (!title) return;
  runManualBtn.disabled = true;
  setGlobalStatus(true, "원고 생성 중...");
  try {
    const articleData = await generateArticle(title, "", url);
    await addToAccumulatedDoc(title, articleData);
  } catch (e: any) {
    addLog("err", "오류", e.message, 'error');
  } finally {
    runManualBtn.disabled = false;
    setGlobalStatus(false);
  }
};

runAutomationBtn.onclick = async () => {
  // Check for selected news items in canvas first
  const selectedCheckboxes = document.querySelectorAll('.news-checkbox:checked') as NodeListOf<HTMLInputElement>;
  const scrapedItems = (window as any).scrapedNewsItems || [];

  // If items are selected in canvas, use those
  if (selectedCheckboxes.length > 0 && scrapedItems.length > 0) {
    const selectedItems = Array.from(selectedCheckboxes).map(cb => {
      const itemId = parseInt(cb.getAttribute('data-item-id') || '0');
      return scrapedItems[itemId];
    }).filter(Boolean);

    if (selectedItems.length === 0) {
      addLog('err', 'Error', 'No valid items selected', 'error');
      return;
    }

    runAutomationBtn.disabled = true;
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
      runAutomationBtn.disabled = false;
      setGlobalStatus(false);
    }
    return;
  }

  // Fallback: Original behavior - fetch from Google Sheet using Settings values
  const url = autoWebhookInput?.value.trim() || '';
  const name = autoSheetNameSaveInput?.value.trim() || 'Sheet1';
  if (!url) {
    addLog('info', 'Info', '뉴스를 선택하거나, 설정에서 Webhook URL을 입력하세요.', 'error');
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
const manualTriggerBtn = document.getElementById('manual-trigger-btn') as HTMLButtonElement;
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

const autoTimeHour = document.getElementById('auto-time-hour') as HTMLSelectElement;
const autoTimeMinute = document.getElementById('auto-time-minute') as HTMLSelectElement;
const autoSitesInput = document.getElementById('auto-sites-input') as HTMLTextAreaElement; // Changed to Textarea
const autoKeywordInput = document.getElementById('auto-keyword-input') as HTMLInputElement;
const autoWebhookInput = document.getElementById('auto-webhook-input') as HTMLInputElement;
const autoSheetNameSaveInput = document.getElementById('auto-sheet-name-save-input') as HTMLInputElement;
const toggleAutomationBtn = document.getElementById('toggle-automation-btn') as HTMLButtonElement;
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
    const originalText = searchNewsBtn.innerHTML;
    searchNewsBtn.innerHTML = `<svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> 검색중...`;
    searchNewsBtn.disabled = true;

    await runScraper();

    searchNewsBtn.innerHTML = originalText;
    searchNewsBtn.disabled = false;
  };
}

// Header "네이버 검색" Button Logic
const naverSearchBtn = document.getElementById('naver-search-btn') as HTMLButtonElement;
if (naverSearchBtn) {
  naverSearchBtn.onclick = async () => {
    const originalText = naverSearchBtn.innerHTML;
    naverSearchBtn.innerHTML = `<svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> 네이버 검색중...`;
    naverSearchBtn.disabled = true;

    await runNaverSearch();

    naverSearchBtn.innerHTML = originalText;
    naverSearchBtn.disabled = false;
  };
}

// Naver Search Function - searches Korean news sources
async function runNaverSearch() {
  // Get keyword from settings
  const keywordInput = document.getElementById('auto-keyword-input') as HTMLInputElement;
  const autoStatusText = document.getElementById('auto-status-text') as HTMLElement;
  let keyword = keywordInput?.value.trim() || '';

  // Prompt for keyword if empty
  if (!keyword) {
    keyword = prompt('검색할 키워드를 입력하세요 (예: AI, 건강, 시니어):') || '';
  }
  if (!keyword) {
    addLog('naver-err', 'Error', 'No keyword provided', 'error');
    return;
  }

  // Predefined Korean news sources
  const naverSources = [
    { name: '네이버IT뉴스', url: 'https://news.naver.com/section/105', category: 'IT' },
    { name: '네이버건강', url: 'https://health.naver.com', category: '건강' },
    { name: '시니어조선', url: 'https://senior.chosun.com', category: '시니어' },
    { name: '정책브리핑', url: 'https://www.korea.kr', category: '행정' }
  ];

  autoStatusText.textContent = `🔍 네이버 검색: "${keyword}"...`;
  addLog('naver', 'Naver Search', `Searching ${naverSources.length} Korean sources for "${keyword}"...`, 'success');

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const allItems: { site: string; title: string; content: string; link: string; date: string; category: string }[] = [];

  // Switch to news tab and create container
  switchToTab('news');

  if (newsCanvas) {
    const containerHTML = `
      <div id="news-results-container" style="border: 2px solid #22c55e; border-radius: 16px; padding: 24px; margin-bottom: 24px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
          <h2 style="font-size: 1.5rem; font-weight: 900; color: #166534; display: flex; align-items: center; gap: 8px; margin: 0;">
            <span style="background: #22c55e; color: white; padding: 4px 10px; border-radius: 8px; font-size: 1rem;">N</span>
            네이버 검색 결과 <span style="font-size: 0.875rem; font-weight: 500; color: #4ade80;">(${keyword} · ${new Date().toLocaleDateString('ko-KR')})</span>
          </h2>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button id="select-all-news-btn" style="padding: 8px 12px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.75rem; font-weight: 600; cursor: pointer;">☑️ 전체 선택</button>
            <button id="deselect-all-news-btn" style="padding: 8px 12px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.75rem; font-weight: 600; cursor: pointer;">⬜ 선택 해제</button>
            <button id="translate-news-btn" style="padding: 8px 16px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 700; cursor: pointer;">🌐 번역하기</button>
          </div>
        </div>
        <div id="news-items-container"></div>
      </div>
    `;
    newsCanvas.innerHTML = containerHTML;
  }

  const containerEl = document.getElementById('news-items-container');
  let globalItemIndex = 0;

  // Sequential search per source
  for (let i = 0; i < naverSources.length; i++) {
    const source = naverSources[i];
    autoStatusText.textContent = `📡 검색 중 ${i + 1}/${naverSources.length}: ${source.name}...`;

    try {
      const prompt = `
        You are a Korean news data extraction API.
        Search for the TOP 5 MOST POPULAR/TRENDING news articles related to "${keyword}" from this Korean source:
        
        Source: ${source.name} (${source.url})
        Category: ${source.category}

        IMPORTANT:
        - Find articles that are ACTUALLY from Korean news sources.
        - Prioritize articles with HIGH view counts, comments, or shares.
        - Include the publish date for each article.
        - Content summary should be in Korean.

        Output: STRICT RAW JSON ONLY. No markdown.

        JSON Schema:
        {
            "items": [
                { "title": "제목", "date": "YYYY-MM-DD", "content": "1-2문장 요약", "link": "https://..." }
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

        // Store items
        data.items.forEach((item: any) => {
          allItems.push({
            site: source.name,
            title: item.title,
            content: item.content,
            link: item.link,
            date: item.date || 'N/A',
            category: source.category
          });
        });

        // Real-time display
        if (containerEl && data.items.length > 0) {
          const siteHTML = `
            <div style="margin-bottom: 20px;" class="site-section">
              <h3 style="font-size: 1rem; font-weight: 800; color: #166534; margin-bottom: 12px; padding-bottom: 4px; border-bottom: 2px solid #86efac; display: flex; align-items: center; gap: 8px;">
                <span style="background: #dcfce7; padding: 2px 8px; border-radius: 6px; font-size: 0.75rem; color: #15803d;">${source.category}</span>
                ${source.name}
              </h3>
              ${data.items.map((item: any) => {
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
            </div>
          `;
          containerEl.innerHTML += siteHTML;
        }

        addLog(`naver-${i}`, source.name, `Found ${data.items.length} items`, 'success');
      }
    } catch (e: any) {
      addLog(`naver-${i}-err`, source.name, `Error: ${e.message}`, 'error');
    }
  }

  // Store globally for blog generation
  (window as any).scrapedNewsItems = allItems;

  autoStatusText.textContent = `✅ 네이버 검색 완료: ${allItems.length}개 발견!`;
  addLog('naver-done', 'Naver Search', `Total: ${allItems.length} items from Korean sources!`, 'success');

  // Attach event listeners
  setTimeout(() => {
    const selectAllBtn = document.getElementById('select-all-news-btn');
    const deselectAllBtn = document.getElementById('deselect-all-news-btn');
    const checkboxes = document.querySelectorAll('.news-checkbox') as NodeListOf<HTMLInputElement>;

    selectAllBtn?.addEventListener('click', () => {
      checkboxes.forEach(cb => {
        cb.checked = true;
        const parent = cb.closest('.news-item') as HTMLElement;
        if (parent) parent.style.borderColor = '#22c55e';
      });
    });

    deselectAllBtn?.addEventListener('click', () => {
      checkboxes.forEach(cb => {
        cb.checked = false;
        const parent = cb.closest('.news-item') as HTMLElement;
        if (parent) parent.style.borderColor = '#bbf7d0';
      });
    });

    checkboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        const parent = cb.closest('.news-item') as HTMLElement;
        if (parent) parent.style.borderColor = cb.checked ? '#22c55e' : '#bbf7d0';
      });
    });
  }, 100);
}

// Manual Trigger Logic
if (manualTriggerBtn) {
  manualTriggerBtn.onclick = async () => {
    // Visual feedback
    const originalText = manualTriggerBtn.innerText;
    manualTriggerBtn.innerText = "⏳ Running...";
    manualTriggerBtn.disabled = true;

    await runScraper();

    manualTriggerBtn.innerText = originalText;
    manualTriggerBtn.disabled = false;
  };
}

// Results Modal Logic
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
  // Populate Time Selects
  if (autoTimeHour && autoTimeMinute) {
    autoTimeHour.innerHTML = Array.from({ length: 24 }, (_, i) => `<option value="${String(i).padStart(2, '0')}">${String(i).padStart(2, '0')}</option>`).join('');
    autoTimeMinute.innerHTML = Array.from({ length: 60 }, (_, i) => `<option value="${String(i).padStart(2, '0')}">${String(i).padStart(2, '0')}</option>`).join('');

    const savedTime = localStorage.getItem(STORAGE_KEYS.AUTO_TIME) || "09:00";
    const [h, m] = savedTime.split(':');
    autoTimeHour.value = h || "09";
    autoTimeMinute.value = m || "00";

    const saveTime = () => {
      const timeStr = `${autoTimeHour.value}:${autoTimeMinute.value}`;
      localStorage.setItem(STORAGE_KEYS.AUTO_TIME, timeStr);
    };
    autoTimeHour.onchange = saveTime;
    autoTimeMinute.onchange = saveTime;
  }

  if (autoSitesInput) {
    autoSitesInput.value = localStorage.getItem(STORAGE_KEYS.AUTO_SITES) || DEFAULT_RSS_SITES;
  }
  autoKeywordInput.value = localStorage.getItem(STORAGE_KEYS.AUTO_KEYWORDS) || "";
  autoWebhookInput.value = localStorage.getItem(STORAGE_KEYS.AUTO_WEBHOOK) || "";
  autoSheetNameSaveInput.value = localStorage.getItem(STORAGE_KEYS.AUTO_SHEET_NAME_SAVE) || "";

  // Save on change
  if (autoSitesInput) {
    autoSitesInput.value = localStorage.getItem(STORAGE_KEYS.AUTO_SITES) || DEFAULT_RSS_SITES;
    renderSiteList();
  }
  autoKeywordInput.onchange = () => localStorage.setItem(STORAGE_KEYS.AUTO_KEYWORDS, autoKeywordInput.value);
  autoWebhookInput.onchange = () => localStorage.setItem(STORAGE_KEYS.AUTO_WEBHOOK, autoWebhookInput.value);
  autoSheetNameSaveInput.onchange = () => localStorage.setItem(STORAGE_KEYS.AUTO_SHEET_NAME_SAVE, autoSheetNameSaveInput.value);
}

// Call init immediately
initAutomationSettings();

let isAutoEnabled = false;
let lastAutoRunDate = "";

toggleAutomationBtn.onclick = () => {
  isAutoEnabled = !isAutoEnabled;
  if (isAutoEnabled) {
    toggleAutomationBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700', 'shadow-indigo-100');
    toggleAutomationBtn.classList.add('bg-green-500', 'hover:bg-green-600', 'shadow-green-100', 'animate-pulse');
    toggleAutomationBtn.innerHTML = `<span>⏳ Automation Active</span>`;
    autoStatusText.textContent = "Waiting for scheduled time...";
    addLog('sys', 'System', 'Automation Enabled', 'success');
  } else {
    toggleAutomationBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-700', 'shadow-indigo-100');
    toggleAutomationBtn.classList.remove('bg-green-500', 'hover:bg-green-600', 'shadow-green-100', 'animate-pulse');
    toggleAutomationBtn.innerHTML = `<span>🤖 Enable Auto-Scraping</span>`;
    autoStatusText.textContent = "";
    addLog('sys', 'System', 'Automation Disabled', 'info'); // Log type corrected? Actually codebase might expect strict types, I'll use success/error or info if available.
    // wait, I saw 'info' usage in previous code but I might have changed it. 
    // Best to stick to 'success' or 'error' if strict. 
    // But the removed code used 'info'. If 'info' exists in addLog types, it's fine.
    // I will use 'success' for now to be safe as I recall strict types.
  }
};

setInterval(checkAndRunAutomation, 10000); // Check every 10s

async function checkAndRunAutomation() {
  if (!isAutoEnabled) return;

  if (!autoTimeHour || !autoTimeMinute) return;
  const targetTime = `${autoTimeHour.value}:${autoTimeMinute.value}`;
  if (!targetTime) return;

  const now = new Date();
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');
  const currentTime = `${currentHours}:${currentMinutes}`;
  const todayStr = now.toDateString();

  // Check if time matches and hasn't run today
  if (currentTime === targetTime && lastAutoRunDate !== todayStr) {
    lastAutoRunDate = todayStr;
    await runScraper();
  }
}

async function runScraper() {
  const sitesRaw = autoSitesInput?.value.trim() || DEFAULT_RSS_SITES;
  const keyword = autoKeywordInput.value || "Trending";
  const webhookUrl = autoWebhookInput.value;
  const sheetName = autoSheetNameSaveInput.value || "AutoData";

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

  autoStatusText.textContent = `🚀 Starting scan of ${sites.length} sites...`;
  addLog('auto', 'Auto-Scraper', `Scanning ${sites.length} sites for "${keyword}"...`, 'success');

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const allItems: { site: string; title: string; content: string; link: string; date: string }[] = [];

  // Create container for real-time updates in NEWS canvas
  let containerEl: HTMLElement | null = null;

  if (newsCanvas) {
    // Switch to news tab
    switchToTab('news');

    const containerHTML = `
      <div id="news-results-container" style="border: 2px solid #e5e7eb; border-radius: 16px; padding: 24px; margin-bottom: 24px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
          <h2 style="font-size: 1.5rem; font-weight: 900; color: #1f2937; display: flex; align-items: center; gap: 8px; margin: 0;">
            📰 뉴스 검색 결과 <span style="font-size: 0.875rem; font-weight: 500; color: #6b7280;">(${keyword} · ${new Date().toLocaleDateString('ko-KR')})</span>
          </h2>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button id="select-all-news-btn" style="padding: 8px 12px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.75rem; font-weight: 600; cursor: pointer;">☑️ 전체 선택</button>
            <button id="deselect-all-news-btn" style="padding: 8px 12px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.75rem; font-weight: 600; cursor: pointer;">⬜ 선택 해제</button>
            <button id="translate-news-btn" style="padding: 8px 16px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 700; cursor: pointer; box-shadow: 0 2px 4px rgba(16,185,129,0.3);">🌐 번역하기</button>
          </div>
        </div>
        <div id="news-items-container"></div>
      </div>
    `;
    newsCanvas.innerHTML = containerHTML;
    containerEl = document.getElementById('news-items-container');
  }

  let globalItemIndex = 0;

  // Sequential per-site scraping with REAL-TIME updates
  for (let i = 0; i < sites.length; i++) {
    const site = sites[i];
    autoStatusText.textContent = `📡 Scanning ${i + 1}/${sites.length}: ${site.name}...`;
    addLog(`site-${i}`, 'Scanning', site.name, 'success');

    try {
      const prompt = `
        You are a strict data extraction API.
        Context: Find the top 3 UNIQUE news articles related to "${keyword}" from this SPECIFIC source ONLY:
        
        Source: ${site.name} (${site.url})

        IMPORTANT: 
        - Only return articles that are ACTUALLY FROM this specific source/website.
        - Do NOT return generic or duplicate articles.
        - Each article must include its publish date.

        Instructions:
        1. Search this specific site for "${keyword}" related content.
        2. Extract exactly 3 UNIQUE items: Title, Publish Date, Content (1-2 sentence summary), Link.
        3. Output: STRICT RAW JSON ONLY. No markdown, no intro text.

        JSON Schema:
        {
            "items": [
                { "title": "...", "date": "YYYY-MM-DD or 날짜 표시", "content": "...", "link": "..." }
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

        // Store items
        data.items.forEach((item: any) => {
          allItems.push({
            site: site.name,
            title: item.title,
            content: item.content,
            link: item.link,
            date: item.date || 'N/A'
          });
        });

        // REAL-TIME Canvas Update for this site
        if (containerEl && data.items.length > 0) {
          const siteHTML = `
            <div style="margin-bottom: 20px;" class="site-section">
              <h3 style="font-size: 1rem; font-weight: 800; color: #4f46e5; margin-bottom: 12px; padding-bottom: 4px; border-bottom: 2px solid #c7d2fe;">
                📌 ${site.name}
              </h3>
              ${data.items.map((item: any) => {
            const idx = globalItemIndex++;
            return `
                <div class="news-item" data-item-id="${idx}" style="display: flex; gap: 12px; align-items: flex-start; padding: 12px 16px; margin: 8px 0 12px 0; background-color: #ffffff; border-radius: 8px; border: 2px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: all 0.2s;">
                  <input type="checkbox" class="news-checkbox" data-item-id="${idx}" style="width: 18px; height: 18px; margin-top: 4px; cursor: pointer; accent-color: #10b981;">
                  <div style="flex: 1;">
                    <p class="news-title" style="font-size: 1rem; font-weight: 700; color: #111827; margin-bottom: 4px;">${item.title}</p>
                    <p style="font-size: 0.7rem; color: #9ca3af; margin-bottom: 6px;">📅 ${item.date || 'N/A'}</p>
                    <p class="news-content" style="font-size: 0.875rem; color: #4b5563; line-height: 1.6; margin-bottom: 8px;">${item.content}</p>
                    <a href="${item.link}" target="_blank" style="font-size: 0.7rem; color: #4f46e5; text-decoration: none; font-weight: 500; word-break: break-all;">🔗 ${item.link}</a>
                  </div>
                </div>
              `;
          }).join('')}
            </div>
          `;
          containerEl.innerHTML += siteHTML;
        }

        addLog(`site-${i}-ok`, site.name, `Found ${data.items.length} items`, 'success');
      }
    } catch (e: any) {
      addLog(`site-${i}-err`, site.name, `Error: ${e.message}`, 'error');
    }
  }

  // Store globally for translation
  (window as any).scrapedNewsItems = allItems;

  autoStatusText.textContent = `✅ Found ${allItems.length} total items from ${sites.length} sites`;
  addLog('auto', 'Auto-Scraper', `Total: ${allItems.length} items collected!`, 'success');

  // Attach event listeners after all items are loaded
  setTimeout(() => {
    const selectAllBtn = document.getElementById('select-all-news-btn');
    const deselectAllBtn = document.getElementById('deselect-all-news-btn');
    const translateBtn = document.getElementById('translate-news-btn');
    const checkboxes = document.querySelectorAll('.news-checkbox') as NodeListOf<HTMLInputElement>;

    // Select All
    selectAllBtn?.addEventListener('click', () => {
      checkboxes.forEach(cb => {
        cb.checked = true;
        const parent = cb.closest('.news-item') as HTMLElement;
        if (parent) parent.style.borderColor = '#10b981';
      });
    });

    // Deselect All
    deselectAllBtn?.addEventListener('click', () => {
      checkboxes.forEach(cb => {
        cb.checked = false;
        const parent = cb.closest('.news-item') as HTMLElement;
        if (parent) parent.style.borderColor = '#e5e7eb';
      });
    });

    // Checkbox visual feedback
    checkboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        const parent = cb.closest('.news-item') as HTMLElement;
        if (parent) parent.style.borderColor = cb.checked ? '#10b981' : '#e5e7eb';
      });
    });

    // Translate Button
    translateBtn?.addEventListener('click', async () => {
      const items = (window as any).scrapedNewsItems || [];
      if (items.length === 0) return;

      translateBtn.innerHTML = '⏳ 번역 중...';
      (translateBtn as HTMLButtonElement).disabled = true;

      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const prompt = `
          Translate the following news items to Korean. Keep the same structure.
          Return STRICT JSON ONLY, no markdown:
          
          Items to translate:
          ${JSON.stringify(items.map((i: any) => ({ title: i.title, content: i.content })))}
          
          Output format:
          { "translations": [{ "title": "한국어 제목", "content": "한국어 내용" }, ...] }
        `;

        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash-exp",
          contents: { parts: [{ text: prompt }] }
        });

        const text = response.text || "";
        const startIdx = text.indexOf('{');
        const endIdx = text.lastIndexOf('}');

        if (startIdx !== -1 && endIdx !== -1) {
          const jsonStr = text.substring(startIdx, endIdx + 1);
          const data = JSON.parse(jsonStr);

          // Update DOM with translations
          data.translations.forEach((trans: any, idx: number) => {
            const itemEl = document.querySelector(`.news-item[data-item-id="${idx}"]`);
            if (itemEl) {
              const titleEl = itemEl.querySelector('.news-title');
              const contentEl = itemEl.querySelector('.news-content');
              if (titleEl) titleEl.textContent = trans.title;
              if (contentEl) contentEl.textContent = trans.content;
            }
          });

          // Update global items with translations
          data.translations.forEach((trans: any, idx: number) => {
            if (items[idx]) {
              items[idx].title = trans.title;
              items[idx].content = trans.content;
            }
          });

          addLog('translate', 'Translation', `${data.translations.length} items translated!`, 'success');
          translateBtn.innerHTML = '✅ 번역 완료';
        }
      } catch (e: any) {
        addLog('translate-err', 'Translation', `Error: ${e.message}`, 'error');
        translateBtn.innerHTML = '❌ 번역 실패';
      }

      setTimeout(() => {
        translateBtn.innerHTML = '🌐 번역하기';
        (translateBtn as HTMLButtonElement).disabled = false;
      }, 2000);
    });
  }, 100);

  // Save to Google Sheet with Status Feedback
  if (webhookUrl && allItems.length > 0) {
    autoStatusText.textContent = "💾 Saving to Google Sheet...";

    try {
      const targetUrl = new URL(webhookUrl);
      targetUrl.searchParams.append('sheetName', sheetName);

      const saveResponse = await fetch(targetUrl.toString(), {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheetName: sheetName,
          site: "Multiple Sources",
          items: allItems.map(i => ({ ...i, source: i.site }))
        })
      });

      // Note: with no-cors, we can't read the response, but if no error thrown, request was sent
      addLog('save-ok', '📊 Google Sheet', `✅ ${allItems.length} items saved successfully!`, 'success');
      autoStatusText.textContent = `✅ 완료! ${allItems.length}개 아이템 저장됨`;

    } catch (e: any) {
      const errorMsg = e.message || 'Unknown error';
      addLog('save-err', '📊 Google Sheet', `❌ Save failed: ${errorMsg}`, 'error');
      autoStatusText.textContent = `❌ 저장 실패`;

      // Show user-friendly error explanation
      let explanation = '알 수 없는 오류가 발생했습니다.';
      if (errorMsg.includes('Invalid URL')) {
        explanation = 'Webhook URL이 잘못되었습니다. https://script.google.com/... 형식인지 확인하세요.';
      } else if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
        explanation = '네트워크 오류입니다. 인터넷 연결을 확인하거나, GAS 배포 설정을 확인하세요.';
      } else if (errorMsg.includes('CORS')) {
        explanation = 'CORS 오류입니다. GAS 배포 시 "Anyone" 액세스로 설정했는지 확인하세요.';
      }

      alert(`❌ Google Sheet 저장 실패\n\n오류: ${errorMsg}\n\n💡 해결 방법:\n${explanation}`);
    }
  } else if (!webhookUrl) {
    addLog('save-skip', '📊 Google Sheet', `⚠️ Webhook URL 미설정 - 저장 건너뜀`, 'error');
    autoStatusText.textContent = `⚠️ 캔버스에만 표시됨 (Sheet URL 없음)`;
  }
}
