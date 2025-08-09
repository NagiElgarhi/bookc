import { GoogleGenAI, GenerateContentResponse, Chat, Type } from "@google/genai";
import { InteractiveContent, UserAnswer, FeedbackItem, MultipleChoiceQuestionBlock, OpenEndedQuestionBlock, InteractiveBlock, Chapter, PageText, TrueFalseQuestionBlock, FillInTheBlankQuestionBlock, Lesson, SearchResult, SearchFilter, AiCorrection, AiBookCategory, SmartSearchResult } from '../types';

let ai: GoogleGenAI | null = null;
let aiInitializationError: Error | null = null;

// Immediately try to initialize.
try {
    // As per guidelines, API key must come from environment variables.
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
} catch (e: any) {
    aiInitializationError = e;
    console.error("FATAL: GoogleGenAI could not be initialized. Ensure the API_KEY environment variable is set.", e);
}

const getAi = (): GoogleGenAI => {
    if (aiInitializationError) {
        throw new Error(`AI service failed to initialize: ${aiInitializationError.message}`);
    }
    if (!ai) {
        throw new Error("AI service is not initialized. Ensure the API_KEY environment variable is set.");
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
        You are a proofreading agent. Your task is to review the following text and correct any spelling or grammatical errors.
        Text:
        ---
        ${text}
        ---
        Required: Return only the corrected text, with no preambles, titles, or markdown formatting.
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

export const summarizeChapterText = async (chapterText: string, style?: string): Promise<string> => {
    const currentAi = getAi();
    if (!chapterText || !chapterText.trim()) {
        return "No text to summarize.";
    }

    const wordCount = chapterText.trim().split(/\s+/).length;
    const targetWordCount = Math.round(wordCount * 0.25);

    const styleInstruction = style ? `
**Step 2.5: Apply Requested Style**
In addition to the preceding rules, you must apply the following style to the summary: "${style}". This directive is mandatory and takes precedence in how the content is presented.
` : '';

    const prompt = `
        You are a high-fidelity summarization expert. Your job is to follow the steps below precisely to create a detailed summary of a book chapter.

        **Step 1: Confirm Word Count**
        The full text of the chapter is provided below. First, count the words in this text to verify. Our calculated word count is ${wordCount} words.

        **Step 2: Determine Summary Length**
        Your task is to create a detailed summary that is exactly **one-quarter (25%)** the length of the original text. Based on the original word count, your summary should be approximately **${targetWordCount} words**. Adherence to this length is mandatory.
        
        ${styleInstruction}

        **Full Chapter Text:**
        ---
        ${chapterText}
        ---

        **Strict and Mandatory Rules for the Summary:**
        1.  **Focus on Detail:** Do not write a brief overview. The summary must be a condensed version of the original text, retaining all important details and ideas.
        2.  **Adhere to Length:** Stick to the target summary length (around ${targetWordCount} words) to ensure detail.
        3.  **No Introductions:** Begin the summary directly. Do not use phrases like "This text summarizes...".
        4.  **Preserve Style:** Maintain the same tone and style as the original author (unless a different style is specified in Step 2.5).
        5.  **No Conclusions:** Do not add any conclusions that were not in the original text.
        6.  **Comprehensiveness:** Extract all key ideas, arguments, evidence, and important examples.

        **Required:**
        Return only the detailed summary as plain text, with no titles or markdown formatting, strictly adhering to the instructions above.
    `;
    
    const apiCall = async () => {
        const response: GenerateContentResponse = await currentAi.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        return response.text?.trim() || "Failed to generate summary.";
    };
    
    try {
         return await callApiWithRetry(apiCall);
    } catch (error) {
        console.error("Error summarizing chapter text after retries:", error);
        return "Sorry, an error occurred while trying to generate the summary.";
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
        You are an intelligent assistant specializing in document structure analysis. Your task is to examine the following text extracted from a file and identify only its high-level structural components, like parts or chapters.

        Extracted text:
        ---
        ${textForAnalysis}
        ---

        The total number of pages in the document is: ${totalPages}.

        **Requirements:**
        1.  Identify the main structural components (e.g., Chapters, Parts) in the document.
        2.  Do not break these components down into sub-lessons or smaller sections at this stage.
        3.  Estimate the start and end page numbers for each main component.
        4.  The last component must extend to the end of the document (page ${totalPages}).
        5.  If you cannot identify clear components, create a single component spanning the entire document.

        Very Important: You must respond with only a single, valid JSON object that strictly follows the provided schema. Do not include any text, markdown, or explanations before or after the JSON object. Double-check for common errors like trailing commas or missing commas between objects.
        The response should be an array of component objects, following this exact schema:
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
        
        return [{ id: generateUniqueId(), title: `Full Document`, startPage: 1, endPage: totalPages }];
    };
    
    try {
        return await callApiWithRetry(apiCall);
    } catch(error) {
        console.error("Error analyzing PDF for structure after retries:", error);
        return [{ id: generateUniqueId(), title: `Full Document`, startPage: 1, endPage: totalPages }];
    }
};

export const analyzeChapterForLessons = async (chapterText: string, chapter: Chapter): Promise<Lesson[] | null> => {
    const currentAi = getAi();
    const prompt = `
        You are an expert in curriculum design. The following text is from a component in a book titled "${chapter.title}", which spans from page ${chapter.startPage} to ${chapter.endPage}.
        Your task is to break this text down into smaller, logical educational "lessons".

        Text for analysis:
        ---
        ${chapterText.substring(0, 50000)}...
        ---

        **Requirements:**
        1.  Identify logical lessons within the text.
        2.  For each lesson, provide a descriptive title.
        3.  Estimate the start and end pages for each lesson. These pages must be within the original component's range of [${chapter.startPage}, ${chapter.endPage}].
        4.  If you cannot identify any clear lessons, return an empty array.
        
        Very Important: You must respond with only a valid JSON object. Do not include any text, markdown, or explanations before or after the JSON object.
        The response should be an array of lesson objects with this schema:
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
        You are a highly intelligent educational expert. Your task is to provide a **comprehensive and detailed explanation** of the following text from a document, turning it into an integrated learning module.

        Extracted text from the document:
        ---
        ${limitedText}
        ---

        **Core Rules (Must be followed strictly):**
        1.  **Comprehensive Explanation (No Summarizing):** Explain the content in full detail. **Do not summarize the content at all**. The goal is to deepen understanding, not brevity.
        2.  **Adherence to Source:** All explanations must be strictly based on the provided text from the document. The only exception is the mandatory examples required below.
        3.  **Include Practical Examples:** If the topic is related to **Mathematics, Physics, Chemistry, or Statistics**, it is very important to include a special section titled **"Illustrative Examples"**. This section must contain **exactly two (2)** practical, step-by-step solved examples to clarify theoretical concepts. These examples should be your creation to enhance the explanation.
        4.  **No Question Generation:** Do not create any test questions of any kind at this stage. Focus solely on the explanatory content.
        5.  **No Images:** Do not include any type of images or diagrams. Focus only on textual and mathematical explanations.

        **Output Format (JSON):**
        Very Important: You must respond with only a single, valid JSON object that strictly follows the provided schema. Do not include any text, markdown, or explanations before or after the JSON object.
        The JSON object must follow this schema exactly:
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
        You are an expert in creating educational assessments. Your task is to create questions based on the following lesson text.

        Lesson Text:
        ---
        ${lessonText.substring(0, 25000)}
        ---

        **Requirements:**
        1.  Create a comprehensive and diverse test of **50 questions** based on the lesson text.
        2.  Use different types of questions (multiple choice, true/false, fill-in-the-blank, open-ended) to test understanding deeply.
        3.  Ensure each object in the array is complete and follows the schema strictly. Check that all property names like 'question', 'options', and 'correctAnswerIndex' are spelled correctly and enclosed in double quotes.

        **Output Format (JSON):**
        Very Important: You must respond with only a valid JSON object. The response must contain an array of question objects that follow one of the following schemas:
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
                correctAnswerText = "This is an open-ended question. Evaluate the answer's logic and relevance.";
                break;
            case 'true_false_question':
                questionText = questionBlock.question;
                userAnswerText = ua.answer ? 'True' : 'False';
                correctAnswerText = questionBlock.correctAnswer ? 'True' : 'False';
                break;
            case 'fill_in_the_blank_question':
                questionText = questionBlock.questionParts.join(' [blank] ');
                userAnswerText = Array.isArray(ua.answer) ? ua.answer.map(a => a || 'empty').join(', ') : 'N/A';
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
        You are an expert teacher. Your task is to evaluate a student's answers and provide constructive feedback.

        The questions and the student's answers, with correct answers for comparison:
        ---
        ${JSON.stringify(qaPairsForAI, null, 2)}
        ---
        
        **Strict Requirements:**
        1.  For each item, compare the \`userAnswer\` with the \`correctAnswer\`.
        2.  Fill the \`isCorrect\` field with \`true\` if the answer is correct, and \`false\` if it is wrong.
        3.  In the \`explanation\` field:
            - If the answer is **correct**, provide simple encouragement like "Great job!".
            - If the answer is **incorrect**, the explanation must start by stating the answer is incorrect, **then you must clearly state the correct answer**.

        Very Important: You must respond with only a valid JSON object. The response must be an array of objects, following this schema exactly, ensuring you return the same \`questionId\` provided for each item:
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
        You are an expert and empathetic teacher. You've been asked to review a student's incorrect answers and provide a detailed, constructive correction for each.

        The incorrect questions and answers:
        ---
        ${JSON.stringify(incorrectAnswers, null, 2)}
        ---
        
        **Requirements:**
        1.  For each question, clearly explain **why the student's answer was incorrect**.
        2.  Then, provide the **correct answer with a full yet simple explanation** of the logic behind it.
        3.  Keep the explanation easy to understand and encouraging.
        
        Very Important: You must respond with only a valid JSON object. The response must be an array of objects, following this schema exactly, ensuring you return the same \`questionId\` provided for each item:
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
        You are an expert in curriculum design. Your task is to generate additional questions based on the following lesson text.

        Lesson Text:
        ---
        ${lessonText.substring(0, 25000)}
        ---

        Existing Questions (avoid repeating these):
        ---
        - ${existingQuestionPrompts}
        ---

        **Requirements:**
        1.  Generate **10 new and diverse questions**.
        2.  The questions must be **different** from the existing ones.
        3.  Use various question types.

        **Output Format (JSON):**
        Very Important: Respond with only a valid JSON object. The response must contain an array of question objects.
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
    const prompt = `You are an expert teacher who specializes in simplifying complex concepts. You have been asked to provide a more detailed and simpler explanation of the following concept for a student who did not understand it well the first time.

Concept to be explained:
---
"${text}"
---

**Requirements:**
1.  Re-explain the concept in simple, clear language.
2.  Use analogies or real-life examples to make the idea more accessible.
3.  Break down the explanation into small, easy-to-follow points if possible.
4.  Your response should be only the explanation, without any introductions or extra phrases.
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
        return "Sorry, an error occurred while trying to get an additional explanation.";
    }
};

export const searchForMaterials = async (query: string, filter: SearchFilter): Promise<SearchResult | null> => {
    const currentAi = getAi();
    
    let filterInstruction = '';
    switch (filter) {
        case 'video':
            filterInstruction = 'Focus your search primarily on YouTube.';
            break;
        case 'sites':
            filterInstruction = 'Exclude YouTube from your search results and focus on other educational websites.';
            break;
        case 'all':
        default:
            filterInstruction = 'Search across both websites and YouTube.';
            break;
    }

    const prompt = `You are an expert search engine specializing in educational content. Your task is to find educational resources about: "${query}".

**Strict Rules:**
1.  **Focused Search:** Search only on educational sites and YouTube channels. ${filterInstruction}
2.  **No Summaries:** Do not write any introduction, summary, or conclusion. Your job is to list links only.
3.  **Precise Output Format:** Each line of your response must be in this exact format:
    [Direct Link to Site or Video] - [A 7-word description in English]
4.  **Order:** Show site links first, then YouTube links.
5.  **Quantity:** Try to find as many results as possible (up to 100).

**Example of Required Format:**
https://www.example.edu/physics101 - The best explanation for high school physics.
https://www.youtube.com/watch?v=example - Final exam review for organic chemistry concepts.
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
            throw new Error('Your search query was blocked by safety filters. Please try a different search term.');
        }
        throw new Error('An error occurred during the search. Please try again.');
    }
};

export const createChat = (): Chat => {
    const currentAi = getAi();
    return currentAi.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: 'You are an intelligent and friendly assistant. Your name is NagiZ. Answer questions in a helpful and concise manner.',
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
            systemInstruction: `You are an intelligent and specialized assistant. Your task is to answer the user's questions based only on the following provided context. Do not use any external information. If the answer is not in the context, state that clearly to the user.

Context:
---
${trimmedContext}
---`,
        },
    });
};

export const searchWithinDocument = async (context: string, query: string): Promise<SmartSearchResult | null> => {
    const currentAi = getAi();
    const prompt = `
        You are an expert research assistant. Your task is to answer the user's query based solely on the provided text context.

        Context:
        ---
        ${context.substring(0, 30000)}
        ---

        User Query: "${query}"

        Requirements:
        1. Find the most relevant information in the context to answer the query.
        2. If the answer is found, formulate a clear and concise answer.
        3. Extract the exact quote(s) from the context that support your answer.
        4. Try to identify the page number(s) from the context. Page numbers are denoted by "--- PAGE [number] ---". Format it as "p. X" or "p. X-Y". If you can't determine the page, use "N/A".
        5. Generate 3 insightful follow-up questions the user might have.
        6. If the answer is not found in the context, your answer should state that clearly, and other fields should be empty or indicate so.

        Your response must be a single, valid JSON object, with no other text or markdown. Adhere strictly to this schema:
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
        You are an expert AI librarian. Your task is to categorize the following list of book titles into relevant main categories and sub-categories.

        Book Titles (with their original IDs):
        ${bookTitles.map(b => `- ${b.name} (id: ${b.id})`).join('\n')}

        Requirements:
        1. Analyze each title to determine its subject matter.
        2. Group the books under appropriate main categories (e.g., "Computer Science", "History", "Literature").
        3. Within each main category, group the books into more specific sub-categories (e.g., "Web Development", "Roman History", "Modernist Novels").
        4. The final output must be only a valid JSON object that strictly follows the provided schema. Do not include any text, markdown, or explanations before or after the JSON.
        5. Every book title from the input list must appear in exactly one sub-category. Respond with the book title only, not the ID.
        6. Category and sub-category names should be in English.

        JSON Schema:
        An array of main category objects. Each object has:
        - "category": string (the name of the main category)
        - "subCategories": an array of sub-category objects. Each object has:
          - "subCategory": string (the name of the sub-category)
          - "books": an array of strings, where each string is a book title belonging to this sub-category.
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