

import { GoogleGenAI, GenerateContentResponse, Chat, Type } from "@google/genai";
import { InteractiveContent, UserAnswer, FeedbackItem, MultipleChoiceQuestionBlock, OpenEndedQuestionBlock, InteractiveBlock, Chapter, PageText, TrueFalseQuestionBlock, FillInTheBlankQuestionBlock, Lesson, SearchResult, SearchFilter, AiCorrection, AiBookCategory, SmartSearchResult } from '../types';

let ai: GoogleGenAI | null = null;
let currentApiKey: string | null = null;

// Function to initialize or re-initialize the AI client
const initializeAi = () => {
    // Priority: environment variable > local storage
    const keyFromEnv = process.env.API_KEY;
    const keyFromStorage = localStorage.getItem('user_provided_api_key');
    
    const keyToUse = keyFromEnv || keyFromStorage;

    // Re-initialize only if the key has changed or was not set before
    if (keyToUse && keyToUse !== currentApiKey) {
        try {
            ai = new GoogleGenAI({ apiKey: keyToUse });
            currentApiKey = keyToUse;
        } catch (e) {
            console.error("Failed to initialize GoogleGenAI with the provided key:", e);
            ai = null;
            currentApiKey = null;
            // Also remove the bad key from storage to prevent re-initialization loops
            if (keyFromStorage === keyToUse) {
                localStorage.removeItem('user_provided_api_key');
            }
        }
    } else if (!keyToUse) {
        // If no key is available, ensure ai is null
        ai = null;
        currentApiKey = null;
    }
};

// Initialize on module load
initializeAi();

// Export a function for the UI to set the key
export const setUserApiKey = (key: string) => {
    localStorage.setItem('user_provided_api_key', key);
    initializeAi(); // Re-initialize with the new key
};

// Export a function to check if a key is available
export const hasValidApiKey = (): boolean => {
    // Re-check from storage in case it was set in another tab
    const keyFromStorage = localStorage.getItem('user_provided_api_key');
    if (keyFromStorage && keyFromStorage !== currentApiKey) {
        initializeAi();
    }
    return !!currentApiKey;
};

// Main getter for the AI instance, used by all other service functions
const getAi = (): GoogleGenAI => {
    if (!ai) {
        // Attempt to re-initialize in case a key was set after a previous failure
        initializeAi();
        // If it's still null, throw a specific, catchable error
        if (!ai) {
            throw new Error("API Key not provided. Please set it via the API Key modal.");
        }
    }
    return ai;
};


const callApiWithRetry = async <T>(apiCall: () => Promise<T>, maxRetries = 3): Promise<T> => {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            return await apiCall();
        } catch (error: any) {
            attempt++;
            const isServerError = error.message && error.message.includes('500 INTERNAL');
            if (isServerError && attempt < maxRetries) {
                console.warn(`Attempt ${attempt} failed with 500 error. Retrying...`);
                await new Promise(res => setTimeout(res, 1000 * attempt)); // Exponential backoff
            } else {
                console.error(`API call failed after ${attempt} attempts:`, error);
                throw error; // Re-throw the error if it's not a server error or retries are exhausted
            }
        }
    }
    throw new Error("API call failed after maximum retries.");
};


const parseJsonResponse = <T,>(text: string): T | null => {
    if (!text || typeof text.trim !== 'function') {
        console.warn("Invalid text input to parseJsonResponse:", text);
        return null;
    }

    let jsonStr = text.trim();
    
    // Attempt to extract from markdown code fences
    const fenceMatch = jsonStr.match(/^```(\w*)?\s*\n?(.*?)\n?\s*```$/s);
    if (fenceMatch && fenceMatch[2]) {
        jsonStr = fenceMatch[2].trim();
    }

    // Find the start and end of the outermost JSON structure
    const firstBracket = jsonStr.indexOf('[');
    const firstBrace = jsonStr.indexOf('{');
    let start = -1;

    if (firstBracket === -1) {
        start = firstBrace;
    } else if (firstBrace === -1) {
        start = firstBracket;
    } else {
        start = Math.min(firstBracket, firstBrace);
    }
    
    if (start === -1) {
        console.error("Could not find start of JSON ('{' or '[') in the string.");
        console.error("Original string for debugging:", text);
        return null; // No JSON found
    }

    const lastBracket = jsonStr.lastIndexOf(']');
    const lastBrace = jsonStr.lastIndexOf('}');
    const end = Math.max(lastBracket, lastBrace);
    
    if (end === -1) {
        console.error("Could not find end of JSON ('}' or ']') in the string.");
        console.error("Original string for debugging:", text);
        return null; // No JSON end found
    }

    // Extract the substring that is likely the JSON content
    jsonStr = jsonStr.substring(start, end + 1);

    try {
        // Clean up common AI-induced errors like trailing commas
        const cleanedJsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(cleanedJsonStr) as T;
    } catch (e) {
        console.error("Failed to parse JSON response after cleaning:", e);
        console.error("Original string for debugging:", text);
        console.error("Cleaned string that failed:", jsonStr);
        return null;
    }
};

const generateUniqueId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

export const proofreadSinglePageText = async (text: string): Promise<string> => {
    const currentAi = getAi();
    if (!text || !text.trim()) {
        return text;
    }
    const prompt = `
        أنت وكيل تدقيق لغوي. مهمتك هي مراجعة النص التالي وتصحيح أي أخطاء إmlائية أو نحوية.
        مهم جداً: تعامل مع النص بلغته الأصلية ولا تقم بترجمته.

        النص:
        ---
        ${text}
        ---
        المطلوب: أعد النص المصحح فقط، بدون أي مقدمات أو عناوين أو markdown.
    `;

    const apiCall = async () => {
        const response: GenerateContentResponse = await currentAi.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        return response.text?.trim() || text;
    };
    
    try {
        return await callApiWithRetry(apiCall);
    } catch (error) {
         console.error("Error proofreading single page text after retries:", error);
         return text; // Return original text on final error
    }
};

export const proofreadFullBook = async (pages: PageText[]): Promise<PageText[] | null> => {
    const currentAi = getAi();
    if (!pages || pages.length === 0) {
        return pages;
    }

    // Combine all pages into a single string with separators
    const fullText = pages.map(p => `--- PAGE ${p.pageNumber} ---\n${p.text}`).join('\n\n');

    const prompt = `
        أنت وكيل تدقيق لغوي خبير. مهمتك هي مراجعة النص التالي، الذي تم تقسيمه حسب أرقام الصفحات، وتصحيح أي أخطاء إملائية أو نحوية.
        مهم جداً: حافظ على بنية النص المقسمة حسب الصفحات باستخدام نفس الفواصل (--- PAGE X ---).
        لا تقم بترجمة النص، بل قم بتصحيحه بلغته الأصلية.

        النص للتصحيح:
        ---
        ${fullText}
        ---

        المطلوب: أعد النص الكامل والمصحح، مع الحفاظ على فواصل الصفحات كما هي، بدون أي مقدمات أو عناوين أو markdown.
    `;

    const apiCall = async () => {
        const response: GenerateContentResponse = await currentAi.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        
        const correctedFullText = response.text;
        if (!correctedFullText) return null;

        // Fallback: If parsing fails, we might have lost pages. Let's do a sanity check.
        // Let's iterate through original pages and find their correction.
        const updatedPages = pages.map(originalPage => {
            const regex = new RegExp(`--- PAGE ${originalPage.pageNumber} ---\n([\\s\\S]*?)(?=--- PAGE|$)`);
            const match = correctedFullText.match(regex);
            return {
                ...originalPage,
                text: match && match[1] ? match[1].trim() : originalPage.text, // Keep original if not found
            };
        });
        
        return updatedPages;
    };

    try {
        return await callApiWithRetry(apiCall);
    } catch (error) {
        console.error("Error proofreading full book:", error);
        return null;
    }
};

export const summarizeChapterText = async (chapterText: string, style?: string): Promise<string> => {
    const currentAi = getAi();
    if (!chapterText || !chapterText.trim()) {
        return "لا يوجد نص لتلخيصه.";
    }

    const wordCount = chapterText.trim().split(/\s+/).length;
    const targetWordCount = Math.round(wordCount * 0.25);

    const styleInstruction = style ? `
**الخطوة 2.5: تطبيق الأسلوب المطلوب**
بالإضافة إلى القواعد السابقة، يجب عليك تطبيق الأسلوب التالي على الملخص: "${style}". هذا التوجيه إلزامي ويعطي الأولوية لكيفية عرض المحتوى.
` : '';

    const prompt = `
        أنت خبير تلخيص فائق الدقة. مهمتك هي اتباع الخطوات التالية بدقة لإنشاء ملخص مفصل لفصل من كتاب.

        **الخطوة 1: تأكيد عدد الكلمات**
        النص الكامل للفصل موجود أدناه. أولاً، قم بعدّ عدد الكلمات في هذا النص للتأكد. عدد الكلمات المحسوب لدينا هو ${wordCount} كلمة.

        **الخطوة 2: تحديد حجم الملخص**
        مهمتك هي إنشاء ملخص مفصل يكون طوله **ربع (25%)** النص الأصلي بالضبط. بناءً على عدد الكلمات الأصلي، يجب أن يكون الملخص الخاص بك حوالي **${targetWordCount} كلمة**. الالتزام بهذا الحجم إلزامي.
        
        ${styleInstruction}

        **النص الكامل للفصل:**
        ---
        ${chapterText}
        ---

        **قواعد صارمة وإلزامية للملخص:**
        1.  **التركيز على التفاصيل:** لا تكتب نبذة مختصرة. يجب أن يكون الملخص نسخة مكثفة من النص الأصلي، تحتفظ بجميع التفاصيل والأفكار الهامة.
        2.  **الالتزام بالحجم:** التزم بحجم الملخص المستهدف (حوالي ${targetWordCount} كلمة) لضمان التفصيل.
        3.  **لا للمقدمات:** ابدأ بالملخص مباشرة. لا تستخدم عبارات مثل "هذا النص يلخص...".
        4.  **الحفاظ على الأسلوب:** حافظ على نفس نبرة وأسلوب الكاتب الأصلي (ما لم يحدد أسلوب مختلف في الخطوة 2.5).
        5.  **لا للاستنتاجات:** لا تضف أي استنتاجات لم تكن في النص الأصلي.
        6.  **الشمولية:** استخلص جميع الأفكار الرئيسية، والحجج، والأدلة، والأمثلة الهامة.
        7.  **الحفاظ على اللغة الأصلية:** تعامل مع النص بلغته الأصلية ولا تترجمه إطلاقاً.

        **المطلوب:**
        أعد الملخص المفصل فقط، كنص نقي بدون أي عناوين أو تنسيق markdown، مع الالتزام الصارم بالتعليمات المذكورة أعلاه.
    `;
    
    const apiCall = async () => {
        const response: GenerateContentResponse = await currentAi.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        return response.text?.trim() || "فشل إنشاء الملخص.";
    };
    
    try {
         return await callApiWithRetry(apiCall);
    } catch (error) {
        console.error("Error summarizing chapter text after retries:", error);
        return "عذرًا، حدث خطأ أثناء محاولة إنشاء الملخص.";
    }
};

export const analyzeDocumentStructure = async (pages: PageText[]): Promise<Chapter[] | null> => {
    const currentAi = getAi();
    const textForAnalysis = pages
        .slice(0, 600)
        .map(p => `--- PAGE ${p.pageNumber} ---\n${p.text}`)
        .join('\n\n');

    const totalPages = pages.length;

    const prompt = `
        أنت مساعد ذكي متخصص في تحليل بنية المستندات. مهمتك هي فحص النص التالي المستخرج من ملف PDF وتحديد مكوناته الهيكلية عالية المستوى فقط، مثل الأجزاء أو الفصول.

        النص المستخرج:
        ---
        ${textForAnalysis}
        ---

        إجمالي عدد الصفحات في المستند هو: ${totalPages}.

        **المتطلبات:**
        1.  حدد المكونات الهيكلية الرئيسية (مثل الفصول أو الأجزاء) في المستند.
        2.  لا تقم بتقسيم هذه المكونات إلى دروس فرعية أو أقسام أصغر في هذه المرحلة.
        3.  قدّر أرقام صفحات البداية والنهاية لكل مكون رئيسي.
        4.  يجب أن يغطي المكون الأخير حتى نهاية المستند (صفحة ${totalPages}).
        5.  إذا لم تتمكن من تحديد مكونات واضحة، فقم بإنشاء مكون واحد يغطي المستند بأكمله.
        6.  **الحفاظ على اللغة:** يجب أن تكون عناوين المكونات بنفس لغة المستند الأصلي. لا تترجمها.

        مهم جداً: يجب عليك الرد فقط بكائن JSON صالح واحد يتبع المخطط المقدم بدقة. لا تقم بتضمين أي نص أو markdown أو شروحات قبل أو بعد كائن JSON. تحقق مرة أخرى من الأخطاء الشائعة مثل الفواصل الزائدة أو الفواصل المفقودة بين الكائنات.
        يجب أن يكون الرد عبارة عن مصفوفة من كائنات المكونات، تتبع هذا المخطط الدقيق:
        [
          {
            "title": "string",
            "startPage": number,
            "endPage": number
          }
        ]
    `;

    const apiCall = async () => {
        const response: GenerateContentResponse = await currentAi.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        
        const rawChapters = parseJsonResponse<Omit<Chapter, 'id'>[]>(response.text);

        if (rawChapters && rawChapters.length > 0) {
            for(let i = 0; i < rawChapters.length - 1; i++) {
                if(rawChapters[i].endPage >= rawChapters[i+1].startPage) {
                    rawChapters[i].endPage = rawChapters[i+1].startPage - 1;
                }
            }
            rawChapters[rawChapters.length - 1].endPage = totalPages;
            
            const chaptersWithIds = rawChapters.map(c => ({...c, id: generateUniqueId()}));
            return chaptersWithIds.filter(c => c.startPage <= totalPages && c.startPage > 0 && c.endPage >= c.startPage);
        }
        
        return [{ id: generateUniqueId(), title: `المستند كاملاً`, startPage: 1, endPage: totalPages }];
    };
    
    try {
        return await callApiWithRetry(apiCall);
    } catch(error) {
        console.error("Error analyzing PDF for structure after retries:", error);
        return [{ id: generateUniqueId(), title: `المستند كاملاً`, startPage: 1, endPage: totalPages }];
    }
};

export const analyzeChapterForLessons = async (chapterText: string, chapter: Chapter): Promise<Lesson[] | null> => {
    const currentAi = getAi();
    const prompt = `
        أنت خبير في تصميم المناهج. النص التالي مأخوذ من مكون في كتاب بعنوان "${chapter.title}"، والذي يمتد من الصفحة ${chapter.startPage} إلى ${chapter.endPage}.
        مهمتك هي تقسيم هذا النص إلى "دروس" تعليمية أصغر ومنطقية. وشرحها شرح واف.

        النص للمعاينة:
        ---
        ${chapterText.substring(0, 50000)}...
        ---

        **المتطلبات:**
        1.  حدد الدروس المنطقية داخل النص.
        2.  لكل درس، قدم عنوانًا وصفيًا.
        3.  قدّر صفحات البداية والنهاية لكل درس. يجب أن تكون هذه الصفحات ضمن نطاق المكون الأصلي [${chapter.startPage}, ${chapter.endPage}].
        4.  إذا لم تتمكن من تحديد أي دروس واضحة، أعد مصفوفة فارغة.
        5.  ضع الفقرة المأخوذه من النص بلون خط أخضر ثم اشرحها بخط لونه أبيض
        6.  **الحفاظ على اللغة:** يجب أن تكون عناوين الدروس بنفس لغة المستند الأصلي. لا تترجمها.

        مهم جداً: يجب عليك الرد فقط بكائن JSON صالح. لا تقم بتضمين أي نص أو markdown أو شروحات قبل أو بعد كائن JSON.
        يجب أن يكون الرد مصفوفة من كائنات الدروس بهذا المخطط:
        [
          {
            "title": "string",
            "startPage": number,
            "endPage": number
          }
        ]
    `;

    const apiCall = async () => {
        const response: GenerateContentResponse = await currentAi.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        const rawLessons = parseJsonResponse<Omit<Lesson, 'id'>[]>(response.text);
        return rawLessons ? rawLessons.map(l => ({...l, id: generateUniqueId()})) : [];
    };

    try {
        return await callApiWithRetry(apiCall);
    } catch (error) {
         console.error(`Error analyzing lessons for chapter "${chapter.title}" after retries:`, error);
        return null;
    }
};

const assignIdsToBlocks = (content: Omit<InteractiveBlock, 'id'>[]): InteractiveBlock[] => {
    return content.map(block => ({...block, id: generateUniqueId()})) as InteractiveBlock[];
};

export const generateInteractiveLesson = async (pdfText: string, lessonPages: PageText[]): Promise<InteractiveContent | null> => {
    const currentAi = getAi();
    const charLimit = 40000;
    
    const lessonTextContent = lessonPages.map(p => {
        return `--- PAGE ${p.pageNumber} ---\n${p.text}`;
    }).join('\n\n');

    const limitedText = lessonTextContent.length > charLimit ? lessonTextContent.substring(0, charLimit) + "..." : lessonTextContent;

    const prompt = `
        أنت خبير تعليمي فائق الذكاء ومهمتك هي تقديم **شرح وافٍ ومفصل** للنص التالي من مستند، وتحويله إلى وحدة تعليمية شاملة باللغة العربية.

        النص المستخرج من المستند:
        ---
        ${limitedText}
        ---

        **القواعد الأساسية (يجب الالتزام بها بشكل صارم):**
        1.  **شرح شامل (لا للتلخيص):** اشرح المحتوى بالتفصيل الكامل. **لا تقم بتلخيص المحتوى إطلاقًا**. يجب أن يكون الهدف هو تعميق الفهم وليس الإيجاز.
        2.  **الالتزام بالمصدر:** يجب أن تستند جميع الشروحات بشكل صارم إلى النص المقدم من المستند. الاستثناء الوحيد هو الأمثلة الإلزامية المطلوبة أدناه.
        3.  **تضمين الأمثلة العملية:** إذا كان الموضوع يتعلق بـ **الرياضيات، الفيزياء، الكيمياء، أو الإحصاء**، فمن المهم جدًا تضمين قسم خاص بعنوان **"أمثلة للتوضيح"**. يجب أن يحتوي هذا القسم على **مثالين (2) فقط** عمليين ومحلولين خطوة بخطوة لتوضيح المفاهيم النظرية. هذه الأمثلة يجب أن تكون من عندك لتعزيز الشرح.
        4.  **عدم إنشاء أسئلة:** لا تقم بإنشاء أي أسئلة اختبار من أي نوع في هذه المرحلة. ركز فقط على محتوى الشرح.
        5.  **لا للصور:** لا تقم بتضمين أي نوع من كتل الصور أو الرسوم البيانية. ركز فقط على الشرح النصي والرياضي.
        6.  **الحفاظ على اللغة:** قم بشرح المحتوى بنفس لغة النص الأصلي. لا تترجم أي شيء.

        **صيغة الإخراج (JSON):**
        مهم جداً: يجب عليك الرد فقط بكائن JSON صالح واحد يتبع المخطط المقدم بدقة. لا تقم بتضمين أي نص أو markdown أو شروحات قبل أو بعد كائن JSON.
        يجب أن يتبع كائن JSON هذا المخطط الدقيق:
        {
          "title": "string",
          "content": [
            { "type": "explanation", "text": "string" },
            { "type": "math_formula", "latex": "string" }
          ]
        }
    `;

    const apiCall = async () => {
        const response: GenerateContentResponse = await currentAi.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        
        const initialContent = parseJsonResponse<Omit<InteractiveContent, 'id' | 'content'> & { content: Omit<InteractiveBlock, 'id'>[] }>(response.text);
        if (!initialContent || !initialContent.content) {
            return null;
        }

        const blocksWithIds = assignIdsToBlocks(initialContent.content);

        return {
            ...initialContent,
            id: generateUniqueId(),
            content: blocksWithIds,
        };
    };

    try {
        return await callApiWithRetry(apiCall);
    } catch (error) {
        console.error("Error generating interactive lesson after retries:", error);
        return null;
    }
};

export const generateInitialQuestions = async (lessonText: string): Promise<InteractiveBlock[] | null> => {
    const currentAi = getAi();
    const prompt = `
        أنت خبير في إنشاء التقييمات التعليمية. مهمتك هي إنشاء أسئلة بناءً على نص الدرس التالي.

        نص الدرس:
        ---
        ${lessonText.substring(0, 25000)}
        ---

        **المتطلبات:**
        1.  أنشئ اختبارًا شاملاً ومتنوعًا مكونًا من **50 سؤالاً** بناءً على نص الدرس.
        2.  استخدم أنواع أسئلة مختلفة (اختيار من متعدد، صح وخطأ، إكمال الفراغ، سؤال مفتوح) لاختبار الفهم بعمق.
        3.  تأكد من أن كل كائن في المصفوفة مكتمل ويتبع المخطط بدقة. تحقق من أن جميع أسماء الخصائص مثل 'question' و 'options' و 'correctAnswerIndex' مكتوبة بشكل صحيح ومحاطة بعلامات اقتباس مزدوجة.
        4.  **لغة الأسئلة:** يجب أن تكون جميع الأسئلة والخيارات بنفس لغة نص الدرس. لا تقم بالترجمة.

        **صيغة الإخراج (JSON):**
        مهم جداً: يجب عليك الرد فقط بكائن JSON صالح. يجب أن يحتوي الرد على مصفوفة من كائنات الأسئلة التي تتبع أحد المخططات التالية:
        [
          { "type": "multiple_choice_question", "question": "string", "options": ["string"], "correctAnswerIndex": number },
          { "type": "true_false_question", "question": "string", "correctAnswer": boolean },
          { "type": "fill_in_the_blank_question", "questionParts": ["string"], "correctAnswers": ["string"] },
          { "type": "open_ended_question", "question": "string" }
        ]
    `;

    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const response: GenerateContentResponse = await currentAi.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                }
            });

            const rawBlocks = parseJsonResponse<Omit<InteractiveBlock, 'id'>[]>(response.text);
            if (rawBlocks) {
                return assignIdsToBlocks(rawBlocks);
            }
             console.warn(`JSON parsing failed on attempt ${attempt + 1}. Retrying...`);
        } catch (error) {
            console.error(`API call failed on attempt ${attempt + 1}:`, error);
        }
        if (attempt < 2) {
             await new Promise(res => setTimeout(res, 500 * (attempt + 1)));
        }
    }

    console.error("Error generating initial questions after multiple attempts.");
    return null; // Return null after all retries fail
};

export const generateQuestionsForPageText = async (pageText: string): Promise<InteractiveBlock[] | null> => {
    const currentAi = getAi();
    const prompt = `
        You are an expert at creating educational assessments. Your task is to generate 10 diverse questions based on the following page text.

        Page Text:
        ---
        ${pageText.substring(0, 15000)}
        ---

        **Requirements:**
        1.  Create a short quiz of **10 diverse questions**.
        2.  Use different question types (multiple_choice_question, true_false_question, fill_in_the_blank_question, open_ended_question).
        3.  All questions and options must be in the same language as the page text. Do not translate.

        **Output Format (JSON):**
        IMPORTANT: You must respond with ONLY a single valid JSON object. The response must be an array of question objects following one of the schemas below:
        [
          { "type": "multiple_choice_question", "question": "string", "options": ["string"], "correctAnswerIndex": number },
          { "type": "true_false_question", "question": "string", "correctAnswer": boolean },
          { "type": "fill_in_the_blank_question", "questionParts": ["string"], "correctAnswers": ["string"] },
          { "type": "open_ended_question", "question": "string" }
        ]
    `;
    
    const apiCall = async () => {
        const response: GenerateContentResponse = await currentAi.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        const rawBlocks = parseJsonResponse<Omit<InteractiveBlock, 'id'>[]>(response.text);
        return rawBlocks ? assignIdsToBlocks(rawBlocks) : null;
    };

    try {
        return await callApiWithRetry(apiCall);
    } catch (error) {
        console.error("Error generating questions for page text:", error);
        return null;
    }
};


export const getFeedbackOnAnswers = async (
    userAnswers: UserAnswer[],
    allQuestions: InteractiveBlock[]
): Promise<FeedbackItem[] | null> => {
    const currentAi = getAi();

    const qaPairsForAI = userAnswers.map(ua => {
        const questionBlock = allQuestions.find(q => q.id === ua.questionId);
        if (!questionBlock || !questionBlock.type.endsWith('_question')) return null;

        let questionText: string | undefined;
        let userAnswerText: string | undefined;
        let correctAnswerText: any;

        switch (questionBlock.type) {
            case 'multiple_choice_question':
                questionText = questionBlock.question;
                userAnswerText = typeof ua.answer === 'number' ? questionBlock.options[ua.answer] : 'N/A';
                correctAnswerText = questionBlock.options[questionBlock.correctAnswerIndex];
                break;
            case 'open_ended_question':
                questionText = questionBlock.question;
                userAnswerText = String(ua.answer);
                correctAnswerText = "هذا سؤال مفتوح، قم بتقييم مدى منطقية الإجابة وارتباطها بالسؤال.";
                break;
            case 'true_false_question':
                questionText = questionBlock.question;
                userAnswerText = ua.answer ? 'صحيح' : 'خطأ';
                correctAnswerText = questionBlock.correctAnswer ? 'صحيح' : 'خطأ';
                break;
            case 'fill_in_the_blank_question':
                questionText = questionBlock.questionParts.join(' [فراغ] ');
                userAnswerText = Array.isArray(ua.answer) ? ua.answer.map(a => a || 'فارغ').join(', ') : 'N/A';
                correctAnswerText = questionBlock.correctAnswers.join(', ');
                break;
        }

        if (questionText && userAnswerText !== undefined) {
             return { questionId: ua.questionId, question: questionText, userAnswer: userAnswerText, correctAnswer: correctAnswerText };
        }
        return null;

    }).filter(Boolean);

    if (qaPairsForAI.length === 0) return [];

    const prompt = `
        ملاحظة هامة: يجب أن تكون اللغة المستخدمة في حقل "explanation" هي اللغة العربية كما هو مطلوب. ومع ذلك، عند الإشارة إلى السؤال أو الإجابة الصحيحة ضمن الشرح، حافظ على لغتها الأصلية ولا تترجمها.

        أنت معلم خبير. مهمتك هي تقييم إجابات الطالب وتقديم ملاحظات بناءة باللغة العربية.

        الأسئلة وإجابات الطالب، مع الإجابات الصحيحة للمقارنة:
        ---
        ${JSON.stringify(qaPairsForAI, null, 2)}
        ---
        
        **متطلبات صارمة:**
        1.  لكل عنصر، قارن \`userAnswer\` مع \`correctAnswer\`.
        2.  املأ حقل \`isCorrect\` بـ \`true\` إذا كانت صحيحة، و \`false\` إذا كانت خاطئة.
        3.  في حقل \`explanation\`:
            - إذا كانت الإجابة **صحيحة**، قدم تشجيعًا بسيطًا مثل "إجابة رائعة!".
            - إذا كانت الإجابة **خاطئة**، يجب أن تبدأ الشرح بذكر أن الإجابة غير صحيحة، **ثم يجب أن تذكر الإجابة الصحيحة بوضوح**.

        مهم جداً: يجب عليك الرد فقط بكائن JSON صالح. يجب أن يكون الرد عبارة عن مصفوفة من الكائنات، تتبع هذا المخطط الدقيق، مع التأكد من إعادة نفس \`questionId\` الذي تم تزويدك به لكل عنصر:
        [
          {
            "questionId": "string",
            "isCorrect": boolean,
            "explanation": "string"
          }
        ]
    `;
    
    const apiCall = async () => {
        const response: GenerateContentResponse = await currentAi.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        
        const feedbackFromAI = parseJsonResponse<Omit<FeedbackItem, 'question' | 'userAnswer'>[]>(response.text);
        if (!feedbackFromAI) return null;

        // Augment feedback with original question/answer for easier display
        return feedbackFromAI.map(fb => {
            const originalPair = qaPairsForAI.find(p => p?.questionId === fb.questionId);
            return {
                ...fb,
                question: originalPair?.question,
                userAnswer: originalPair?.userAnswer,
            };
        });
    };

    try {
        return await callApiWithRetry(apiCall);
    } catch (error) {
        console.error("Error getting feedback after retries:", error);
        return null;
    }
};

export const getAiCorrections = async (
    incorrectAnswers: { questionId: string; question: string; userAnswer: string; }[]
): Promise<AiCorrection[] | null> => {
    const currentAi = getAi();
    if (incorrectAnswers.length === 0) return [];

    const prompt = `
        ملاحظة هامة: يجب أن تكون اللغة المستخدمة في حقل "correction" هي اللغة العربية كما هو مطلوب. ومع ذلك، عند الإشارة إلى السؤال أو الإجابة الصحيحة ضمن الشرح، حافظ على لغتها الأصلية ولا تترجمها.
        
        أنت معلم خبير ومتفهم. طُلب منك مراجعة إجابات طالب كانت غير صحيحة وتقديم تصحيح مفصل وبناء لكل منها باللغة العربية.

        الأسئلة والإجابات غير الصحيحة:
        ---
        ${JSON.stringify(incorrectAnswers, null, 2)}
        ---
        
        **المتطلبات:**
        1.  لكل سؤال، اشرح بوضوح **لماذا كانت إجابة الطالب خاطئة**.
        2.  بعد ذلك، قدم **الإجابة الصحيحة مع شرح كامل ومبسط للمنطق** وراءها.
        3.  اجعل الشرح سهل الفهم ومشجعًا.
        
        مهم جداً: يجب عليك الرد فقط بكائن JSON صالح. يجب أن يكون الرد عبارة عن مصفوفة من الكائنات، تتبع هذا المخطط الدقيق، مع التأكد من إعادة نفس \`questionId\` الذي تم تزويدك به لكل عنصر:
        [
          {
            "questionId": "string",
            "correction": "string" 
          }
        ]
    `;

    const apiCall = async () => {
         const response: GenerateContentResponse = await currentAi.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        
        return parseJsonResponse<AiCorrection[]>(response.text);
    };
    
    try {
        return await callApiWithRetry(apiCall);
    } catch (error) {
        console.error("Error getting AI corrections after retries:", error);
        return null;
    }
};


export const generateMoreQuestions = async (
    lessonText: string, 
    existingQuestions: InteractiveBlock[]
): Promise<InteractiveBlock[] | null> => {
    const currentAi = getAi();
    
    const existingQuestionPrompts = existingQuestions.map(q => {
        if (!q || !q.type) return '';
        switch (q.type) {
            case 'multiple_choice_question':
            case 'open_ended_question':
            case 'true_false_question':
                return q.question;
            case 'fill_in_the_blank_question':
                return q.questionParts.join(' ___ ');
            default: return '';
        }
    }).filter(Boolean).join('\n - ');

    const prompt = `
        أنت خبير في تصميم المناهج. مهمتك هي إنشاء أسئلة إضافية بناءً على نص الدرس التالي.

        نص الدرس:
        ---
        ${lessonText.substring(0, 25000)}
        ---

        الأسئلة الموجودة حاليًا (تجنب تكرارها):
        ---
        - ${existingQuestionPrompts}
        ---

        **المتطلبات:**
        1.  أنشئ **10 أسئلة جديدة ومتنوعة**.
        2.  يجب أن تكون الأسئلة **مختلفة** عن الأسئلة الموجودة.
        3.  استخدم أنواع أسئلة مختلفة.
        4.  **لغة الأسئلة:** يجب أن تكون جميع الأسئلة والخيارات الجديدة بنفس لغة نص الدرس. لا تقم بالترجمة.

        **صيغة الإخراج (JSON):**
        مهم جداً: يجب عليك الرد فقط بكائن JSON صالح. يجب أن يحتوي الرد على مصفوفة من كائنات الأسئلة.
    `;

    const apiCall = async () => {
        const response: GenerateContentResponse = await currentAi.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });

        const rawBlocks = parseJsonResponse<Omit<InteractiveBlock, 'id'>[]>(response.text);
        return rawBlocks ? assignIdsToBlocks(rawBlocks) : null;
    };
    
    try {
        return await callApiWithRetry(apiCall);
    } catch (error) {
        console.error("Error generating more questions after retries:", error);
        return null;
    }
};

export const getDeeperExplanation = async (text: string): Promise<string | null> => {
    const currentAi = getAi();
    const prompt = `أنت معلم خبير ومتخصص في تبسيط المفاهيم المعقدة. طُلب منك تقديم شرح أكثر تفصيلاً وبساطة للمفهوم التالي لطالب لم يفهمه جيدًا من المرة الأولى.

المفهوم المطلوب شرحه:
---
"${text}"
---

**المتطلبات:**
1.  **الحفاظ على اللغة:** أعد شرح المفهوم بنفس لغة النص الأصلي. لا تترجمه. اجعل الشرح بسيطًا وواضحًا.
2.  استخدم التشبيهات أو الأمثلة الواقعية لتقريب الفكرة.
3.  قسم الشرح إلى نقاط صغيرة وسهلة المتابعة إذا أمكن.
4.  يجب أن يكون ردك هو الشرح فقط، بدون أي مقدمات أو عبارات إضافية.
`;

    const apiCall = async () => {
        const response = await currentAi.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text;
    };
    
    try {
        return await callApiWithRetry(apiCall);
    } catch (error) {
        console.error("Error getting deeper explanation after retries:", error);
        return "عذرًا، حدث خطأ أثناء محاولة الحصول على شرح إضافي.";
    }
};

export const searchForMaterials = async (query: string, filter: SearchFilter): Promise<SearchResult | null> => {
    const currentAi = getAi();
    
    let filterInstruction = '';
    switch (filter) {
        case 'video':
            filterInstruction = 'ركز بحثك بشكل أساسي على منصة يوتيوب.';
            break;
        case 'sites':
            filterInstruction = 'استبعد منصة يوتيوب من نتائج بحثك وركز على المواقع التعليمية الأخرى.';
            break;
        case 'all':
        default:
            filterInstruction = 'ابحث في كل من المواقع الإلكترونية ومنصة يوتيوب.';
            break;
    }

    const prompt = `أنت محرك بحث خبير ومتخصص في المحتوى التعليمي المصري. مهمتك هي العثور على مصادر تعليمية حول: "${query}".

**قواعد صارمة:**
1.  **التركيز المطلق:** ابحث فقط في المواقع الإلكترونية وقنوات اليوتيوب التعليمية **المصرية**. ${filterInstruction}
2.  **لا للملخصات:** لا تكتب أي مقدمة أو ملخص أو خاتمة. مهمتك هي عرض قائمة الروابط فقط.
3.  **تنسيق الإخراج الدقيق:** يجب أن يكون كل سطر في ردك بهذا التنسيق بالضبط:
    [رابط مباشر للموقع أو الفيديو] - [وصف باللغة العربية من 7 كلمات بالضبط]
4.  **الترتيب:** اعرض روابط المواقع الإلكترونية أولاً، ثم روابط اليوتيوب.
5.  **الكمية:** حاول العثور على أكبر عدد ممكن من النتائج (حتى 100 نتيجة).

**مثال للتنسيق المطلوب:**
https://www.example.edu.eg/physics101 - أفضل شرح لمادة الفيزياء للصف الأول الثانوي.
https://www.youtube.com/watch?v=example - مراجعة ليلة الامتحان في مادة الكيمياء العضوية.
`;

    const apiCall = async () => {
        const response: GenerateContentResponse = await currentAi.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });

        const textResponse = response.text;
        if (!textResponse) {
             return { sources: [] };
        }

        const sources = textResponse.split('\n')
            .map(line => line.trim())
            .filter(line => line.includes(' - ') && (line.startsWith('http://') || line.startsWith('https://')))
            .map(line => {
                const parts = line.split(' - ');
                const uri = parts[0].trim();
                const title = parts.slice(1).join(' - ').trim();
                return { uri, title };
            })
            .filter((source): source is { uri: string, title: string } => !!source.uri && !!source.title);

        return { sources };
    };

    try {
        return await callApiWithRetry(apiCall);
    } catch (error) {
        console.error(`Error searching for materials on "${query}" after retries:`, error);
        if (error instanceof Error && error.message.includes('SAFETY')) {
            throw new Error('تم حظر طلب البحث الخاص بك بواسطة مرشحات الأمان. يرجى تجربة مصطلح بحث مختلف.');
        }
        throw new Error('حدث خطأ أثناء البحث. يرجى المحاولة مرة أخرى.');
    }
};

export const createChat = (): Chat => {
    const currentAi = getAi();
    return currentAi.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: 'أنت مساعد أكاديمي متخصص. مهمتك هي مناقشة المحتوى العلمي والتعليمي والمعرفي فقط، بما في ذلك تحليل الملفات التي يرفعها المستخدم (PDF, Word, صور). ارفض بأدب أي محادثة عادية أو غير ذات صلة بالمواضيع الأكاديمية. أجب دائمًا بنفس لغة سؤال المستخدم.',
        },
    });
};

export const extractTextFromImage = async (base64Image: string, mimeType: string): Promise<string | null> => {
    const currentAi = getAi();
    const imagePart = {
        inlineData: {
            mimeType: mimeType,
            data: base64Image.split(',')[1], // remove data:mime/type;base64, part
        },
    };
    const textPart = {
        text: "Extract any text visible in this image. Respond only with the extracted text, maintaining original line breaks if possible. If no text is present, respond with an empty string."
    };

    const apiCall = async () => {
        const response = await currentAi.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
        });
        return response.text;
    }
    
    try {
        return await callApiWithRetry(apiCall);
    } catch (error) {
        console.error("Error extracting text from image:", error);
        return null;
    }
};

export const createChatWithContext = (context: string): Chat => {
    const currentAi = getAi();
    const trimmedContext = context.substring(0, 30000); // safety trim
    return currentAi.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: `أنت مساعد ذكي ومتخصص. مهمتك هي الإجابة على أسئلة المستخدم بالاعتماد **فقط** على السياق التالي المقدم لك. لا تستخدم أي معلومات خارجية. أجب دائمًا بنفس لغة سؤال المستخدم. إذا لم تكن الإجابة موجودة في السياق، فأخبر المستخدم بذلك بوضوح.

السياق:
---
${trimmedContext}
---`,
        },
    });
};

export const searchWithinDocument = async (context: string, query: string): Promise<SmartSearchResult | null> => {
    const currentAi = getAi();
    const prompt = `
        You are an expert research assistant. Your task is to answer the user's query based ONLY on the provided text context.

        CONTEXT:
        ---
        ${context.substring(0, 30000)}
        ---

        USER QUERY: "${query}"

        REQUIREMENTS:
        1. Find the most relevant information in the context to answer the query.
        2. If the answer is found, formulate a clear and concise answer in Arabic.
        3. Extract the exact quote(s) from the context that support your answer.
        4. Try to identify the page number(s) from the context. Page numbers are denoted by "--- PAGE [number] ---". Formulate this as "p. X" or "pp. X-Y". If you cannot determine the page, use "N/A".
        5. Generate 3 insightful follow-up questions in Arabic that the user might have.
        6. If the answer cannot be found in the context, your answer should state that clearly in Arabic, and the other fields should be empty or indicate that.
        7. The "quote" field must be an exact extraction from the text without translation.

        Your response MUST be a single valid JSON object, with no other text or markdown. Adhere strictly to this schema:
        {
          "answer": "string",
          "quote": "string",
          "pages": "string",
          "follow_ups": ["string", "string", "string"]
        }
    `;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            answer: { type: Type.STRING },
            quote: { type: Type.STRING },
            pages: { type: Type.STRING },
            follow_ups: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        },
        required: ["answer", "quote", "pages", "follow_ups"]
    };

    const apiCall = async () => {
        const response: GenerateContentResponse = await currentAi.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema
            }
        });
        return parseJsonResponse<SmartSearchResult>(response.text);
    };

    try {
        return await callApiWithRetry(apiCall);
    } catch (error) {
        console.error("Error in searchWithinDocument:", error);
        return null;
    }
};

export const categorizeBooks = async (bookTitles: {id: string, name: string}[]): Promise<AiBookCategory[] | null> => {
    const currentAi = getAi();
    if (bookTitles.length === 0) {
        return [];
    }

    const prompt = `
        You are an expert librarian AI. Your task is to categorize the following list of book titles into main categories and relevant sub-categories.

        Book Titles (with their original IDs):
        ${bookTitles.map(b => `- ${b.name} (id: ${b.id})`).join('\n')}

        Requirements:
        1. Analyze each title to determine its subject matter.
        2. Group books under appropriate main categories (e.g., "Computer Science", "History", "Literature").
        3. Within each main category, group books into more specific sub-categories (e.g., "Web Development", "Roman History", "Modernist Novels").
        4. The final output must be ONLY a valid JSON object that strictly follows the provided schema. Do not include any text, markdown, or explanations before or after the JSON.
        5. Each book title from the input list must appear in exactly one sub-category. Respond with the book's title only, not the ID.
        6. The category and subCategory names must be in Arabic, even if the book titles are in another language.

        JSON Schema:
        An array of main category objects. Each object has:
        - "category": string (The name of the main category in Arabic)
        - "subCategories": An array of sub-category objects. Each object has:
          - "subCategory": string (The name of the sub-category in Arabic)
          - "books": An array of strings, where each string is a book title belonging to this sub-category.
    `;
    
    const responseSchema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                category: { type: Type.STRING },
                subCategories: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            subCategory: { type: Type.STRING },
                            books: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ["subCategory", "books"]
                    }
                }
            },
            required: ["category", "subCategories"]
        }
    };

    const apiCall = async () => {
        const response = await currentAi.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema
            }
        });

        return parseJsonResponse<AiBookCategory[]>(response.text);
    };

    try {
        return await callApiWithRetry(apiCall);
    } catch (error) {
        console.error("Error categorizing books:", error);
        return null;
    }
};

export const explainPageContent = async (pageText: string): Promise<string | null> => {
    const currentAi = getAi();
    if (!pageText || !pageText.trim()) {
        return "This page appears to be empty or contains only images.";
    }

    const prompt = `
        أنت خبير تعليمي متخصص. مهمتك هي تقديم شرح وافٍ ومفصل للمحتوى التالي من صفحة في مستند.
        يجب أن يكون الشرح عميقًا ويغطي النقاط الرئيسية بالتفصيل، مع الحفاظ على الوضوح والبساطة قدر الإمكان.
        مهم جداً: تعامل مع النص بلغته الأصلية ولا تقم بترجمته.

        النص:
        ---
        ${pageText.substring(0, 15000)}
        ---

        المطلوب: الشرح المفصل فقط، كنص نقي بدون أي مقدمات أو عناوين أو تنسيق markdown.
    `;

    const apiCall = async () => {
        const response: GenerateContentResponse = await currentAi.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        return response.text?.trim() || "Could not generate an explanation.";
    };
    
    try {
        return await callApiWithRetry(apiCall);
    } catch (error) {
         console.error("Error explaining page content after retries:", error);
         return "Sorry, an error occurred while generating the explanation.";
    }
};
