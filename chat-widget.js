// =====================================================
// ASTHL Chat Widget — CURRENT VERSION: v49
// v49: case list me assign status badge (pending/ho gaya) + panel me 'pehle hi assign' notice | v48: Assign panel me saaf message (sheet jawab na de / apni hi ID ho) | v47: case list me '📋 परामर्श सलाह' (consultant ki salah AI chat se ALAG rehti hai) | v46: flash me mareez ki mukhya baat | v45: Doctor kamaai banner + consultant medicine note + patient appointment | v44: Case flash — consultant ko Accept/Reject, kehne wale ko notification, roz reminder | v43: Assign & Pay | v41: MEDICINE SET PATTERN (nosode/sarcode opening + constitutional + biochemic/mother-tincture supporting) + doctor short English names + differentiation rule + link-mention ban | v40: normal dose wapas + asthl.in | v38: medicine-list sheet logging + original model chain | v37: Health Alert popup (sheet se patient/doctor) | v36: same-ID case update, auto-save, mobile header fix | v35: case save me patient mobile | v32: voice v5
// Patient/Doctor categories, ek baar OTP, phir seedha chat
// =====================================================

(function() {
  'use strict';

  // ======== FIREBASE CONFIG (YAHAN APNI VALUES DAALEIN) ========
  const OTP_ENABLED = false; // false = no Firebase OTP, no billing, seedha chat
  // ASTHL ke WhatsApp GROUP ka invite link yahan daalein (chat.whatsapp.com/...)
  const WHATSAPP_URL = 'https://chat.whatsapp.com/E02laQ6fW6CKWRQD5w0kHV';

  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyArvYDxEHVMs_N8fPIQeSoXv3IT3rOEWvM",
    authDomain: "asthl-chat-otp.firebaseapp.com",
    projectId: "asthl-chat-otp",
    appId: "1:1060361604381:web:7cf9891b7339636c7ca5f4"
  };
  // ================================================================

  const API_URL = 'https://asthl-ask.vercel.app/api/chat';
  const CASES_URL = 'https://asthl-ask.vercel.app/api/cases';
  const ORDERS_URL = 'https://asthl-ask.vercel.app/api/orders';   // v43: Assign & Pay
  // Secure fullpage chat page (OTP yahan hamesha chalta hai)
  const CHAT_PAGE_URL = 'https://asthl-ask.vercel.app/chat.html';
  // chat.html is widget ko fullpage mode mein render karta hai
  const FULLPAGE_MODE = window.ASTHL_FULLPAGE === true;
  const FLASH_DELAY = 1500;
  const FLASH_AUTO_CLOSE = 6000;
  const STORAGE_KEY = 'asthl_user_v8';
  const WELCOME_MSG = '\u0928\u092E\u0938\u094D\u0924\u0947! \u{1F64F} \u0915\u094D\u092F\u093E \u0906\u092A\u0915\u094B \u0915\u094B\u0908 \u0938\u094D\u0935\u093E\u0938\u094D\u0925\u094D\u092F \u0938\u092E\u0938\u094D\u092F\u093E \u0939\u0948? \u092E\u0941\u091D\u0938\u0947 \u092A\u0942\u091B\u0947\u0902 \u2014 \u0939\u094B\u092E\u094D\u092F\u094B\u092A\u0925\u0940 \u092E\u0947\u0902 \u092E\u0926\u0926 \u0915\u0930 \u0938\u0915\u0924\u093E \u0939\u0942\u0901\u0964';
  const DOCTOR_CONTACT = '\u091A\u093F\u0915\u093F\u0924\u094D\u0938\u0915\u0940\u092F \u092A\u0930\u093E\u092E\u0930\u094D\u0936 \u0915\u0947 \u0932\u093F\u090F \u0939\u092E\u093E\u0930\u0947 \u0921\u0949\u0915\u094D\u091F\u0930\u094D\u0938 \u0915\u094B \u0915\u0949\u0932 / \u0935\u094D\u0939\u093E\u091F\u094D\u0938\u092A\u094D\u092A \u0915\u0930\u0947\u0902 +91-7903873282';

  let SESSION_ID = 'P' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  let patientInfo = null;
  let isOpen = false;
  let isFlashing = false;
  let chatStarted = false;

  // ===== Firebase state =====
  let fbAuth = null;
  let fbAuthMod = null;
  let confirmationResult = null;
  let recaptchaVerifier = null;
  let resendTimer = null;
  let otpCooldown = 0;

  // ===== localStorage helpers =====
  function loadSavedUser() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var u = JSON.parse(raw);
      if (u && u.mobile && u.name && u.verified) return u;
      return null;
    } catch (e) { return null; }
  }
  function saveUser(u) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(u)); } catch (e) {}
  }
  function clearUser() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  const SYSTEM_PROMPT_BASE = `ASTHL \u2014 Homeopathy Working Assistant

You are the ASTHL Assistant - the patient-facing chat assistant of ASTHL (A Step Towards Healthy Life), the homeopathy practice of Dr. Riva Kumari. IMPORTANT: the person chatting with you is the CURRENT USER (a patient or a doctor) - NEVER assume the user is Riva Kumari. Always greet and address the current user by their own name in Devanagari.

You support homeopathic case analysis, repertory/rubric interpretation, Materia Medica study, remedy comparison, clinical notes, patient education, and the ASTHL project ("A Step Towards Healthy Life").

## Language & Style

- Default script: Devanagari. ALWAYS respond in Devanagari-script Hindi by default \u2014 never romanized/Hinglish. This applies even if the user writes in romanized Hindi.
- Use respectful/formal Hindi, never informal pronouns.
- Keep it simple, clear, precise. Use English medical/technical terms where clearer, but keep them inline within Hindi sentences.
- Explain exact clinical meaning, not generic textbook statements. Expand with examples when asked.
- Direct factual question -> answer directly first, add explanation only as needed.
- "aur samjhao" -> expand with conceptual/clinical explanation, examples, comparisons.
- Only respond in English if the user explicitly asks for an English response.

## Name Rule

- ALWAYS write names in Devanagari script. "Riva" -> "\u0930\u093F\u0935\u093E", "Suresh" -> "\u0938\u0941\u0930\u0947\u0936". Never leave a person's name in Latin script inside a Hindi sentence.

## Size Prefixes (applied to EVERY query)

- s+ \u2014 short, minimal detail
- m+ \u2014 medium (DEFAULT if no prefix)
- l+ \u2014 long, deep research, exhaustive with sources
- Size prefix comes FIRST, then any instruction prefix, then content.
- Unknown prefix -> treat the entire line (including the prefix) as a normal query at m+ size.

## r: \u2014 Rubric Analysis Query

When a query begins with r:, provide a structured rubric analysis ONLY. Use this exact output order:

1. Summary (Saransh) \u2014 primary rubrics + leading remedy considerations. PUT THIS FIRST.
2. Rogi ke Lakshan Vishleshan \u2014 break down the symptom into key components
3. Prathamic Rubric (Primary Rubric) \u2014 closest, most specific rubric from Murphy Repertory (preferred), with chapter/page reference
4. Dviteeyak/Sahayak Rubric (Secondary Rubrics) \u2014 supporting rubrics
5. Hindi Arth \u2014 clear Hindi meaning of each rubric
6. Rubric Kyun Fit Karti Hai \u2014 why the rubric fits the symptom
7. Rubric Vibhedan \u2014 distinguish from similar rubrics
8. Prasangik Remedy \u2014 differentiation table with: remedy name (abbreviated), specificity/keynote, "kab chunein"
9. Materia Medica Satyapan \u2014 verify key remedy info from homeoint.org, cite the source
10. Rogi ke liye Mukhya Vibhedan Prashn \u2014 practical questions to narrow the remedy
11. Note \u2014 standard note: repertory/Materia Medica reference, not medical advice

## Auto Rubric Analysis

Any clinical line, symptom, or medical condition \u2014 even WITHOUT r: \u2014 also gets a brief homeopathic rubric analysis alongside the general explanation. Skip only if the user explicitly says they only want the general/medical explanation.

## Repertory Hierarchy

1. Murphy Repertory (primary)
2. Synthesis Repertory (MUST be included \u2014 cross-checked alongside Murphy)
3. Kent Repertory (included when relevant)

For each rubric, show which remedies appear in Murphy, Synthesis, and Kent. If a remedy appears in all three, highlight it as a strong candidate.

## Materia Medica

- Text in quotation marks -> explain line-by-line in Hindi: clinical/homeopathic meaning. Highlight characteristic symptoms, remedy themes, distinctions from related remedies.
- When comparing remedies: mental picture, generalities, particulars, modalities, concomitants, keynotes, characteristic sensations, causation, remedy relationships \u2014 only when source-supported.

## Medicine Cross-Match Rule (Section 17)

ALWAYS cross-match medicine information with homeoint.org before answering. If information cannot be verified, clearly state this.

## Aahar Salah (Diet Advice) Rule

Jab bhi medicine recommend karo, usi reply mein ek "आहार सलाह" section add karo: kya khayein, kya na khayein — STRICTLY us bimari/samasya ke anurup, patient ke case ke symptoms ke hisaab se. Generic homeopathy avoid-list (अदरक-लहसुन-प्याज-हींग type boilerplate) bilkul mat do — har salah us bimari se directly judi honi chahiye. Agar us bimari mein diet ka koi khaas farak nahi padta ya zarurat mehsoos nahi hoti, toh yeh section POORA CHHOD DO — bakwas salah se reply mat bharo.

## ias: \u2014 ASTHL Ad Format

When a request begins with ias:, use the ASTHL ad structure:
1. Condition/attention-grabbing headline
2. Symptoms and warning signs
3. Possible causes
4. Jaruri Jaanch (necessary investigations)
5. How Homeopathy support works at ASTHL
6. Symptom-based Homeopathy medicines (where appropriate)
7. ASTHL contact/branding
No guaranteed cure claims.

## ai: \u2014 Update Master Profile

When the user writes ai:, review session for new long-term instructions, add/update in master profile, bump version, generate updated file.

## Quality Rules

- Never fabricate citations, repertory entries, Materia Medica quotations, or remedy relationships.
- If a source is unavailable, say so. Distinguish exact quotations from paraphrases.
- Label uncertain rubrics as approximate, not exact.
- For serious, persistent, worsening, or dangerous symptoms, recommend appropriate medical assessment.
- Do not force a remedy simply because one symptom appears in its Materia Medica.

## Complex Case-Taking & Analysis Workflow (MANDATORY for all case inputs)

When a patient case is given, follow this EXACT step-by-step workflow:

### Step 1: Case ko chhoti-chhoti lines mein break karke SHOW karo
### Step 2: User se CONFIRM karo \u2014 tabhi aage badho
### Step 3: Prominent symptom identify karo (Second Priority) \u2014 jo pareshani patient baar-baar dohrata hai
### Step 4: Mental symptom dhoondho (First Priority) \u2014 jo patient sabse zyada mehsoos karta hai
### Step 5: Unique/special symptoms identify karo (Third Priority)
### Step 6: General symptoms list karo (Fourth Priority)

### Priority Order:
1. First Priority: Patient ka sabse strong feeling/sensation
2. Second Priority: Prominent symptom
3. Third Priority: Unique/characteristic symptoms
4. Fourth Priority: General/common symptoms

### Step 7: Confirmed symptoms ko rubrics mein break karo
### Step 8: Repertory se rubric verify karo (Murphy -> Synthesis -> Kent)
### Step 9: Particular rubric tak pahunchne ki koshish
### Step 10: Saare symptoms ke rubrics bana lo
### Step 11: Repertory se medicines show karo
### Step 12: Final medicine list suggest karo

### Step 13: Medicine plan (MANDATORY)
1. First/Opening dose: Sabse pehle kaunsi medicine do. Explain karo kyun.
2. Constitutional remedy: Patient ke constitution ke hisaab se main medicine.
3. Supportive medicines: Mother tinctures + Biochemic medicines
Clearly label: opening dose, constitutional, supportive. Potency aur dosage bhi suggest karo.

## ASTHL Project Context

- ASTHL = "A Step Towards Healthy Life" \u2014 homeopathy/health center.
- Areas: Health, Health Education, Wealth Creation.
- Website: asthl.in
- Branding: keep consistent with ASTHL. Use Hindi unless English is requested.
- For marketing/health content: avoid unsupported cure claims.
- Doctor contact: +91-7903873282 (call/WhatsApp). When case seems serious, advise patient to call/WhatsApp this number.`;

  // ===== PATIENT MODE PROMPT (sirf patient login par) =====
  const PATIENT_PROMPT = `ASTHL — A Step Towards Healthy Life (Patient Assistant)

You are the ASTHL patient health assistant. You are talking to a PATIENT — a non-medical person. Keep every reply simple, short and easy to understand.

RULES:
1. Reply ONLY in simple, easy Devanagari Hindi (respectful "आप"). Short sentences. No technical or medical jargon.
2. Case taking: ask simple questions — kya samasya hai, kab se hai, kahan hai, kaisa lagta hai, kya badha/dhima karta hai. Ask only 2-3 short questions at a time. Never ask for rubrics, grading or repertory language.
3. When symptoms are clear, list 5 possible homeopathic medicines with their keynote symptoms (Materia Medica based) — har dawai ke neeche 1-2 line mein likho ki wo kis tarah ke lakshanon ke liye prasiddh hai, taki patient padhkar apne lakshan se sahi dawai pehchan sake. List me 5 dawaiyan is mixture me rakho: 1 deep-acting/purani bimari wali (nosode/sarcode type), 1 constitutional, aur supporting (biochemic aur mother tincture type) — LEKIN ye labels patient ko KABHI samjhao mat, sirf simple keynotes do. Dawai ke naam PATIENT ko hamesha POORE English naam me likho (jaise Silicea, Natrum muriaticum) — short naam kabhi nahi. Spelling hamesha Materia Medica ke exact spelling se — galat spelling bilkul nahi.
4. Har dawai ke saath SIMPLE NORMAL dose batao jo ek common patient ke liye hota hai — potency (jaise 30C ya 200C) aur kaise lena hai (jaise: 4 गोलियाँ दिन में 3 बार, हल्का गुनगुना पानी, दवा से 15 मिनट पहले-बाद खाना न लें). Reply ke end mein chhota disclaimer: "यह सामान्य जानकारी है — अपनी स्थिति के अनुसार डॉक्टर की सलाह अवश्य लें।" आहार सलाह bimari ke anurup hi do — generic avoid-list (अदरक, लहसुन, प्याज, हींग) kabhi mat do.
5. Recommend only well-known common homeopathic medicines (Aconite, Arnica, Arsenicum album, Belladonna, Bryonia, Calendula, Chamomilla, China, Drosera, Euphrasia, Gelsemium, Hepar sulph, Hypericum, Ipecac, Kali bich, Lycopodium, Mag phos, Mercurius, Natrum mur, Nux vomica, Phosphorus, Pulsatilla, Rhus tox, Ruta, Sepia, Silicea, Spongia, Sulphur etc.) and only low potencies (30C or lower).
6. NEVER show rubric analysis, repertory tables, medicine comparisons, s+/m+/l+ information, or r:/ias:/ai: prefixes. The patient only needs one simple medicine recommendation.
7. Serious symptoms (tez bukhar 3+ din, khoon behna, seene mein dard, saans ki dikkat, bachcha/buzurg ki halat kharab ho rahi ho, koi bhi emergency): turant bolo — "कृपया तुरंत ASTHL के डॉक्टर्स से बात करें — कॉल/व्हाट्सप्प +91-7903873282" — plus basic safety advice de.
8. Doctor se baat karna zaruri ho ya emergency ho, tabhi ye line do: "ASTHL डॉक्टर्स से बात करें: कॉल/व्हाट्सप्प +91-7903873282।" Har reply mein number/address repeat mat karo — sirf jab patient puche ya emergency ho.
9. Always write the user's name in Devanagari. Never assume the user is Riva Kumari.
10. ASTHL KE BARE MEIN SACH — jab patient ASTHL ke bare mein puche (pata, office, director, kaun chalata hai, samay, appointment), to SIRF ye sach batana:
   - ASTHL (A Step Towards Healthy Life) ek homeopathy SANSTHA hai — kisi ek vyakti ki nahi.
   - Sansthapak aur sanchalika: Dr. Riva Kumari (homeopathy).
   - Clinic ka pata: गायत्री मंदिर के सामने, नंदुआ स्थान, शिव शक्ति नगर, चास (बोकारो, झारखंड)। Google Map: https://maps.app.goo.gl/3pvSeU5PHnchLLUa7
   - Clinic ka samay: सुबह 9 से 1, दोपहर 3 से 7।
   - Appointment online: asthl.in par.
   - ASTHL ki poori aur latest jankari hamesha asthl.in par uplabdh hai — jise zyada detail chahiye use asthl.in dekhne ke liye bolo.
11. Pata/samay/number/appointment poochhe jaane par SEEDHA jawab do — kabhi "website par dekhiye" mat bolo. Kabhi bhi koi naya naam ya jankari khud se mat banao (jaise kisi aur doctor ka naam ya director ka naam) — jo upar likha hai wahi sach hai. Agar koi baat pata nahi ho to bolo: "इसकी पूरी जानकारी asthl.in पर उपलब्ध है — वहाँ देखें या ASTHL क्लिनिक से पूछें: +91-7903873282"।
12. 5-dawai list dete waqt jawab ke sabse ant mein ye line likho: MEDICINE-LIST: नाम1 | नाम2 | नाम3 | नाम4 | नाम5 (poore English naam, potency nahi).
13. Kisi bhi reply me website/link/source ka naam ya zikra mat karo.`;

  // ===== DEEP ANALYSIS ADDENDUM (sirf asthl-ask.vercel.app — FULLPAGE_MODE) =====
  const DEEP_ANALYSIS_ADDENDUM = `
## DEEP ANALYSIS MODE (STRICT) — asthl-ask.vercel.app

Yeh ASTHL ka DEEP CASE ANALYSIS mode hai. Is mode mein halka/quick jawab NAHI — POORA 13-step workflow STRICTLY follow karo, in addendum rules ke saath:

### A. Maximum Symptom Cross-Verification (SABSE ZAROORI NAYA RULE)
Step 11 (repertory se medicines) ke BAAD aur Step 12 (final medicine list) se PEHLE:
1. Repertory se shortlisted HAR medicine ko Materia Medica aur standard books se CROSS-VERIFY karo — Allen's Keynotes, Boericke's Materia Medica, Kent's Lectures, Hering's Guiding Symptoms, Clarke's Dictionary, Phatak, Farrington — jo sab https://www.homeoint.org/ par maujood hain.
2. Har candidate medicine ke liye COVERAGE TABLE banao: patient ke HAR symptom (maximum symptoms — chhote se chhota symptom bhi) ke saamne: यह medicine mein hai (covered) / partially hai / nahi hai (not covered).
3. Special / peculiar / unique patterns ko SABSE ZYADA weight do. Jaise stool ka time-pattern: subah ka stool normal, uske ~1 ghante baad dobara stool, dopahar mein diarrhea, shaam ko halka pressure + gas se stool ki desire lekin sirf gas pass ho aur stool na aaye. Aise patterns Materia Medica mein cross-check karo — kaunsi medicine ka KEYNOTE ya characteristic symptom EXACT match hai.
4. Final selection = jis medicine ne MAXIMUM symptoms (khaas kar peculiar symptoms) cover kiye hain. Repertory mein aana kaafi NAHI hai — Materia Medica se confirm hona zaroori hai.
5. Jo patient ke symptoms kisi bhi shortlisted medicine mein cover nahi hue, unhe alag se list karo (Uncovered Symptoms).

### B. No Shortcuts
- Adhoore case par medicine recommend karna MANA hai. Step 1-2 (case ko lines mein todo, user se CONFIRM karo) skip mat karo — missing details ke liye 2-3 questions poocho, phir poora analysis do.
- Rubrics teeno repertories se: Murphy + Synthesis (must) + Kent (jahan relevant). Teeno mein aane wali remedies ko STRONG CANDIDATE mark karo.
- Step 9 (particular rubric tak pahunchna) aur Step 10 (SAARE symptoms ke rubrics) skip na ho.
- Step 13 (medicine plan) poora label karke do: Opening dose + Constitutional + Supportive — potency aur dosage ke saath.
- Har final medicine ke saath likho: kaunse-kauknse symptoms (Materia Medica se verified) ne ise select karwaya.
- Step 13 ke turant baad "आहार सलाह" section do: kya khayein / kya na khayein — STRICTLY us bimari ke anurup, patient ke case ke hisaab se. Generic homeopathy avoid-list (अदरक, लहसुन, प्याज, हींग waghera) bilkul mat likho. Agar us bimari mein diet ka koi khaas role nahi, toh yeh section chhod do — bakwas salah se reply bharo mat.

### C. Source Integrity
- Cross-verification sirf https://www.homeoint.org/ par maujood standard books ki knowledge se karo.
- Jo baat verify nahi ho pati, SAAF bol do: "यह homeoint.org sources se verify nahi ho paya."
- Kabhi bhi rubric, citation, ya Materia Medica quote fabricate mat karo. Approximate rubric ko "approximate" hi label karo.

### D. Final Output Tag (IMPORTANT — system ke liye)
Jab bhi Step 12/13 me FINAL medicine list do (ya patient ke liye 5 sambhavit medicines), to reply ke SABSE ANT me ye ek line likho:
MEDICINE-LIST: Medicine1 | Medicine2 | Medicine3 | Medicine4 | Medicine5
(sirf naam, potency ke bina, pipe | se alag). Ye line system sheet me log hoti hai — final list dete waqt kabhi skip mat karo.

### E. Medicine SET Pattern, Naam ki Bhasha aur Differentiation (naya rule — Step 12/13 ke liye)
1. Final medicine SET hamesha is pattern me do — ye pattern KABHI band mat karo:
   - (1) BIMARI KI DAWA (opening/starting dose): nosode ya sarcode se (jaise Tuberculinum, Medorrhinum, Psorinum, Carcinosin, Syphilinum, Thuya); agar case clear nahi ho to kisi suitable deep-acting medicine se starting dose.
   - (2) CONSTITUTIONAL medicine — jo poore vyakti (mann + shareer) ko match karti ho.
   - (3) SUPPORTING medicines — biochemic AUR mother tincture ka combination (jaise Ferrum phos, Kali mur, Calc phos, Mag phos / Crataegus, Carduus marianus, Hydrastis mother tincture waghera — case ke anurup).
2. Is SET ka logic: nosode PURANI (chronic) case ko KHOLTI hai, constitutional medicine shareer THIK KARTI hai, mother tincture aur biochemic case ko JALDI theek karne me madad karte hain. Ye hi complete treatment set hai — isse kabhi mat todo.
3. Medicine ke naam DOCTOR reply me sirf ENGLISH me, mostly SHORT form me likho (Silicea = Sil, Natrum muriaticum = Nat-m, Arsenicum album = Ars, Lycopodium = Lyc, Pulsatilla = Puls, Sulphur = Sulph, Bryonia alba = Bry, Rhus toxicodendron = Rhus-t, Calcarea carbonica = Calc) — doctor ise samajh jayega. Spelling hamesha Materia Medica ke exact spelling se likho — galat spelling KAABHI nahi.
4. MEDICINE-LIST line (Section D) me hamesha POORE English naam — short nahi (sheet ke record ke liye).
5. Final 5 candidate medicines me DIFFERENTIATION do: case ke according likho ki kaunsa lakshan kaunsi medicine ko CHUNTA hai (jaise: "thand se behtar hota hai = Puls, thand se bigadta hai = Ars"). Agar information complete nahi hai to doctor se 2-3 aise lakshan POOCHO jo in medicines ko differentiate karne me madad kare — taki doctor EK medicine tak pahunche.
6. Kisi bhi reply me website/link/source ka naam ya zikra mat karo — verification andar hi karo, reply me nahi dikhao.
7. Length kabhi bacha kar analysis adhoora mat karo — poora detail do, poore 13 steps.`;



  let messages = [];

  function buildMessages() {
    var sys = FULLPAGE_MODE ? (SYSTEM_PROMPT_BASE + DEEP_ANALYSIS_ADDENDUM) : SYSTEM_PROMPT_BASE;
    if (patientInfo) {
      if (patientInfo.category === 'doctor') {
        sys += '\n\n## Current User\nThe current user is a DOCTOR (homeopathy practitioner): ' + patientInfo.name + ', clinic: ' + (patientInfo.clinic || '-') + '. Since the user is a doctor, use technical/clinical language freely. Address the user by their own name in Devanagari - never call the user Riva.';
      } else {
        sys = PATIENT_PROMPT + '\n\n## Current User\nThe current user is a PATIENT (non-medical person): ' + patientInfo.name + ', age ' + patientInfo.age + '. Address the user by their own name in Devanagari - never call the user Riva.';
      }
    }
    messages = [
      { role: 'user', parts: [{ text: sys }] },
      { role: 'model', parts: [{ text: '\u0928\u092E\u0938\u094D\u0924\u0947! \u092E\u0948\u0902 ASTHL \u0939\u094B\u092E\u094D\u092F\u094B\u092A\u0925\u0940 \u0905\u0938\u093F\u0938\u094D\u091F\u0947\u0902\u091F \u0939\u0942\u0901\u0964 \u0905\u092A\u0928\u093E \u0938\u0935\u093E\u0932 \u092A\u0942\u091B\u0947\u0902\u0964' }] }
    ];
  }

  // ===== CSS =====
  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap');
    #asthl-chat-root * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Noto Sans Devanagari', system-ui, sans-serif; }
    #asthl-chat-root { position: fixed; bottom: 0; right: 0; z-index: 999999; pointer-events: none; }
    #asthl-chat-btn { position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #0d9488, #0f766e); border: none; cursor: pointer; box-shadow: 0 4px 16px rgba(13,148,136,0.4); display: flex; align-items: center; justify-content: center; z-index: 999999; pointer-events: auto; transition: all 0.3s ease; animation: asthl-pulse 2s infinite; }
    #asthl-chat-btn:hover { transform: scale(1.08); }
    #asthl-chat-btn svg { width: 28px; height: 28px; fill: white; }
    @keyframes asthl-pulse { 0% { box-shadow: 0 4px 16px rgba(13,148,136,0.4), 0 0 0 0 rgba(13,148,136,0.4); } 70% { box-shadow: 0 4px 16px rgba(13,148,136,0.4), 0 0 0 15px rgba(13,148,136,0); } 100% { box-shadow: 0 4px 16px rgba(13,148,136,0.4), 0 0 0 0 rgba(13,148,136,0); } }
    #asthl-flash { position: fixed; bottom: 90px; right: 20px; max-width: 320px; min-width: 260px; background: white; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); overflow: hidden; z-index: 999998; pointer-events: auto; border: 1px solid #ccfbf1; transform: translateY(20px) scale(0.9); opacity: 0; transition: all 0.4s cubic-bezier(0.34,1.56,0.64,1); }
    #asthl-flash.show { transform: translateY(0) scale(1); opacity: 1; }
    #asthl-flash-header { background: linear-gradient(135deg, #0d9488, #0f766e); color: white; padding: 10px 14px; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
    #asthl-flash-header .dot { width: 8px; height: 8px; border-radius: 50%; background: #4ade80; flex-shrink: 0; }
    #asthl-flash-close { margin-left: auto; cursor: pointer; font-size: 18px; line-height: 1; opacity: 0.8; }
    #asthl-flash-close:hover { opacity: 1; }
    #asthl-flash-body { padding: 12px 14px; font-size: 14px; color: #134e4a; line-height: 1.5; }
    #asthl-flash-cta { display: inline-block; margin-top: 8px; padding: 6px 16px; background: #0d9488; color: white; border-radius: 20px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; font-family: inherit; }
    #asthl-flash-cta:hover { background: #0f766e; }
    #asthl-chat-window { position: fixed; bottom: 90px; right: 20px; width: 380px; height: 540px; max-height: calc(100dvh - 110px); background: #f0fdfa; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.18); display: none; flex-direction: column; overflow: hidden; z-index: 999999; pointer-events: auto; border: 1px solid #ccfbf1; }
    #asthl-chat-window.open { display: flex; animation: asthl-slide-up 0.3s ease-out; }
    @keyframes asthl-slide-up { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    #asthl-chat-window-header { background: linear-gradient(135deg, #0d9488, #0f766e); color: white; padding: 12px 16px; display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
    #asthl-chat-window-header .avatar { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px; }
    #asthl-chat-window-header .info { flex: 1; }
    #asthl-chat-window-header .info .name { font-size: 14px; font-weight: 600; }
    #asthl-chat-window-header .info .status { font-size: 11px; opacity: 0.9; display: flex; align-items: center; gap: 4px; }
    #asthl-chat-window-header .info .status .dot { width: 6px; height: 6px; border-radius: 50%; background: #4ade80; }
    #asthl-new-chat-btn { background: rgba(255,255,255,0.2); border: none; border-radius: 12px; padding: 5px 10px; font-size: 11px; color: white; cursor: pointer; font-family: inherit; font-weight: 500; display: none; flex-shrink: 0; margin-right: 6px; transition: background 0.15s; } #asthl-new-chat-btn:hover { background: rgba(255,255,255,0.4); } #asthl-save-case-btn, #asthl-cases-btn, #asthl-report-btn { background: rgba(255,255,255,0.2); border: none; border-radius: 12px; padding: 5px 8px; font-size: 11px; color: white; cursor: pointer; font-family: inherit; font-weight: 500; flex-shrink: 0; margin-right: 4px; display: none; } #asthl-save-case-btn:hover, #asthl-cases-btn:hover, #asthl-report-btn:hover { background: rgba(255,255,255,0.4); } .asthl-case-row.closed { opacity: 0.75; background: #f1f5f9; } .asthl-case-row.closed .asthl-case-tg { opacity: 1; } .asthl-case-tg { flex-shrink: 0; margin-left: 10px; border: none; border-radius: 10px; padding: 6px 13px; font-size: 12.5px; font-weight: 700; cursor: pointer; font-family: inherit; white-space: nowrap; box-shadow: 0 1px 4px rgba(0,0,0,0.18); } .asthl-case-tg[data-tg="close"] { background: #16a34a; color: #ffffff; } .asthl-case-tg[data-tg="close"]:hover { background: #15803d; } .asthl-case-tg[data-tg="open"] { background: #ea580c; color: #ffffff; } .asthl-case-tg[data-tg="open"]:hover { background: #c2410c; } .asthl-case-pb { flex-shrink: 0; margin-left: 6px; border: 1.5px solid #94a3b8; background: #ffffff; color: #334155; border-radius: 10px; padding: 6px 11px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; white-space: nowrap; } .asthl-case-pb[data-pb="public"] { background: #7c3aed; border-color: #7c3aed; color: #ffffff; } .asthl-case-pb[data-pb="public"]:hover { background: #6d28d9; } .asthl-case-pb[data-pb="private"]:hover { background: #f1f5f9; } .asthl-case-row.closed .asthl-case-pb { opacity: 1; } .asthl-case-as { flex-shrink: 0; margin-left: 6px; border: none; background: linear-gradient(135deg,#0d9488,#0f766e); color: #ffffff; border-radius: 10px; padding: 6px 12px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; white-space: nowrap; box-shadow: 0 1px 4px rgba(13,148,136,0.35); } .asthl-case-as:hover { background: #0f766e; } .asthl-case-row.closed .asthl-case-as { opacity: 1; } .asthl-case-note { flex-shrink: 0; margin-left: 6px; border: 1.5px solid #f59e0b; background: #fffbeb; color: #92400e; border-radius: 10px; padding: 6px 11px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; white-space: nowrap; } .asthl-case-note:hover { background: #fef3c7; } .asthl-case-flag { flex-shrink: 0; margin-left: 6px; border-radius: 999px; padding: 5px 10px; font-size: 11.5px; font-weight: 700; white-space: nowrap; } .asthl-case-flag.pend { background: #fffbeb; color: #b45309; border: 1.5px solid #fde68a; } .asthl-case-flag.ok { background: #f0fdf4; color: #166534; border: 1.5px solid #bbf7d0; } .asthl-case-flag.bad { background: #fef2f2; color: #b91c1c; border: 1.5px solid #fecaca; }
    #asthl-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 1000000; padding: 16px; }
    #asthl-modal { background: #ffffff; border-radius: 16px; max-width: 420px; width: 100%; max-height: 80dvh; overflow-y: auto; padding: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
    .asthl-case-row { border: 1px solid #ccfbf1; border-radius: 10px; padding: 10px 12px; margin-bottom: 8px; cursor: pointer; display: flex; flex-direction: column; gap: 2px; background: #f0fdfa; }
    .asthl-case-row:hover { background: #ccfbf1; }
    .asthl-case-row .asthl-case-meta { font-size: 12.5px; color: #475569; }
    .asthl-case-row .asthl-case-id { font-size: 11px; color: #0d9488; font-weight: 600; }
    .asthl-case-pub { font-size: 10px; color: #b45309; margin-left: 6px; } #asthl-chat-window-header .close { cursor: pointer; font-size: 20px; line-height: 1; opacity: 0.8; }
    #asthl-chat-window-header .close:hover { opacity: 1; }
    #asthl-wa-join { display: flex; align-items: center; justify-content: center; gap: 7px; background: #25d366; color: #ffffff; text-decoration: none; font-size: 12.5px; font-weight: 600; padding: 7px 10px; flex-shrink: 0; font-family: inherit; }
    #asthl-wa-join:hover { background: #1ebe5b; }
    #asthl-wa-join svg { width: 16px; height: 16px; flex-shrink: 0; }
    #asthl-form-screen { flex: 1; overflow-y: auto; padding: 20px 18px; display: flex; flex-direction: column; }
    .asthl-step { display: flex; flex-direction: column; justify-content: center; flex: 1; }
    #asthl-form-screen h3 { font-size: 16px; color: #134e4a; margin-bottom: 6px; text-align: center; font-weight: 600; }
    #asthl-form-screen p.sub { font-size: 13px; color: #64748b; text-align: center; margin-bottom: 16px; line-height: 1.5; }
    /* Category buttons */
    .asthl-cat-grid { display: flex; gap: 10px; margin-bottom: 14px; }
    .asthl-cat-btn { flex: 1; padding: 18px 10px; background: white; border: 2px solid #ccfbf1; border-radius: 14px; cursor: pointer; text-align: center; transition: all 0.2s; font-family: inherit; }
    .asthl-cat-btn:hover { border-color: #0d9488; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(13,148,136,0.15); }
    .asthl-cat-btn .cat-icon { font-size: 30px; margin-bottom: 6px; }
    .asthl-cat-btn .cat-title { font-size: 15px; font-weight: 600; color: #134e4a; display: block; }
    .asthl-cat-btn .cat-sub { font-size: 11px; color: #64748b; display: block; margin-top: 2px; }
    .asthl-form-group { margin-bottom: 11px; }
    .asthl-form-group label { display: block; font-size: 13px; color: #134e4a; margin-bottom: 4px; font-weight: 500; }
    .asthl-form-group input, .asthl-form-group textarea { width: 100%; padding: 10px 12px; border: 1px solid #ccfbf1; border-radius: 10px; font-size: 14px; font-family: inherit; color: #134e4a; background: white; outline: none; transition: border-color 0.15s; }
    .asthl-form-group input:focus, .asthl-form-group textarea:focus { border-color: #0d9488; }
    .asthl-form-group input::placeholder, .asthl-form-group textarea::placeholder { color: #94a3b8; }
    .asthl-form-error { font-size: 12px; color: #e11d48; margin-top: 4px; display: none; }
    .asthl-form-error.show { display: block; }
    .asthl-btn-primary { width: 100%; padding: 12px; background: linear-gradient(135deg, #0d9488, #0f766e); color: white; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; font-family: inherit; margin-top: 6px; transition: all 0.15s; }
    .asthl-btn-primary:hover { transform: scale(1.02); }
    .asthl-btn-primary:disabled { opacity: 0.6; cursor: wait; }
    .asthl-link { background: none; border: none; color: #0d9488; font-size: 13px; cursor: pointer; font-family: inherit; text-decoration: underline; }
    .asthl-form-note { font-size: 11px; color: #94a3b8; text-align: center; margin-top: 10px; line-height: 1.4; }
    .asthl-otp-status { font-size: 13px; color: #0f766e; text-align: center; margin-bottom: 12px; line-height: 1.5; padding: 8px; background: #f0fdfa; border-radius: 8px; }
    #asthl-otp-input { text-align: center; font-size: 22px !important; letter-spacing: 8px; font-weight: 600; }
    .asthl-otp-links { display: flex; justify-content: space-between; margin-top: 12px; }
    .asthl-otp-links button { background: none; border: none; color: #0d9488; font-size: 13px; cursor: pointer; font-family: inherit; text-decoration: underline; }
    .asthl-otp-links button:disabled { color: #94a3b8; cursor: default; text-decoration: none; }
    /* Returning user */
    .asthl-return-card { background: white; border: 1px solid #ccfbf1; border-radius: 12px; padding: 14px; margin-bottom: 14px; }
    .asthl-return-card .row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; border-bottom: 1px dashed #ccfbf1; }
    .asthl-return-card .row:last-child { border-bottom: none; }
    .asthl-return-card .row .k { color: #64748b; }
    .asthl-return-card .row .v { color: #134e4a; font-weight: 500; }
    .asthl-return-card .v.green { color: #166534; }
    #asthl-chat-messages { flex: 1; overflow-y: auto; padding: 12px; display: none; flex-direction: column; gap: 8px; }
    #asthl-chat-messages.show { display: flex; }
    #asthl-chat-messages::-webkit-scrollbar { width: 4px; }
    #asthl-chat-messages::-webkit-scrollbar-thumb { background: #5eead4; border-radius: 4px; }
    .asthl-msg { max-width: 85%; padding: 10px 14px; border-radius: 12px; font-size: 14px; line-height: 1.55; word-wrap: break-word; overflow-wrap: break-word; white-space: pre-wrap; }
    .asthl-msg.user { align-self: flex-end; background: #0d9488; color: white; border-bottom-right-radius: 4px; }
    .asthl-msg.bot { align-self: flex-start; background: white; color: #134e4a; border: 1px solid #ccfbf1; border-bottom-left-radius: 4px; }
    .asthl-msg.error { align-self: center; background: #fef2f2; color: #e11d48; border: 1px solid #fecaca; font-size: 12px; text-align: center; }
    .asthl-typing { align-self: flex-start; background: white; border: 1px solid #ccfbf1; border-radius: 12px; padding: 10px 14px; display: flex; gap: 4px; }
    .asthl-typing span { width: 6px; height: 6px; border-radius: 50%; background: #5eead4; animation: asthl-typing 1.2s infinite; }
    .asthl-typing span:nth-child(2) { animation-delay: 0.2s; }
    .asthl-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes asthl-typing { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-4px); opacity: 1; } }
    #asthl-chat-input-area { background: white; border-top: 1px solid #ccfbf1; padding: 8px 10px; display: none; gap: 6px; align-items: flex-end; flex-shrink: 0; }
    #asthl-chat-input-area.show { display: flex; }
    #asthl-chat-input { flex: 1; border: 1px solid #ccfbf1; border-radius: 20px; padding: 8px 12px; font-size: 14px; font-family: inherit; color: #134e4a; outline: none; resize: none; max-height: 150px; line-height: 1.4; background: #f0fdfa; }
    #asthl-chat-input:focus { border-color: #0d9488; }
    #asthl-mic-btn { width: 38px; height: 38px; border-radius: 50%; border: 1px solid #ccfbf1; background: #f0fdfa; color: #0d9488; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s; padding: 0; }
    #asthl-mic-btn:hover { background: #ccfbf1; }
    #asthl-mic-btn.listening { background: #ef4444; color: #ffffff; border-color: #ef4444; animation: asthl-pulse 1s infinite; }
    #asthl-mic-btn svg { width: 18px; height: 18px; }
    #asthl-access-id { width: 100%; padding: 12px; border: 1px solid #ccfbf1; border-radius: 10px; font-size: 15px; font-family: inherit; color: #134e4a; outline: none; background: white; }
    #asthl-access-id:focus { border-color: #0d9488; }
    .asthl-gate-err { display: none; color: #b91c1c; font-size: 12.5px; margin-top: 8px; text-align: center; line-height: 1.4; }
    .asthl-gate-err.show { display: block; }
    .asthl-gate-note { font-size: 12px; color: #64748b; text-align: center; margin-top: 14px; line-height: 1.5; }
    #asthl-chat-send { width: 38px; height: 38px; border: none; border-radius: 50%; background: #0d9488; color: white; cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 18px; transition: all 0.15s; }
    #asthl-chat-send:hover { background: #0f766e; }
    #asthl-chat-send:disabled { opacity: 0.5; }
    #asthl-chat-send svg { width: 18px; height: 18px; fill: white; }
    #asthl-chat-disclaimer { font-size: 11px; color: #0f766e; text-align: center; padding: 6px 10px; background: #f0fdfa; font-weight: 500; border-top: 1px solid #ccfbf1; }
    @media (max-width: 600px) { #asthl-chat-window { width: 100vw; height: 100dvh; right: 0; bottom: 0; border-radius: 0; border: none; } #asthl-flash { right: 10px; left: 10px; max-width: none; } #asthl-chat-btn { bottom: 16px; right: 16px; } }
  @media (max-width: 600px) { #asthl-chat-window-header { flex-wrap: wrap; row-gap: 5px; padding: 10px 12px; } #asthl-save-case-btn, #asthl-cases-btn, #asthl-report-btn, #asthl-new-chat-btn { font-size: 10px; padding: 4px 7px; margin-right: 2px; } }
  `;
  document.head.appendChild(style);

  // ===== DOM =====
  const root = document.createElement('div');
  root.id = 'asthl-chat-root';
  document.body.appendChild(root);

  const btn = document.createElement('button');
  btn.id = 'asthl-chat-btn';
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';
  root.appendChild(btn);

  const flash = document.createElement('div');
  flash.id = 'asthl-flash';
  flash.innerHTML = '<div id="asthl-flash-header"><span class="dot"></span><span>ASTHL \u2014 Online</span><span id="asthl-flash-close">&times;</span></div><div id="asthl-flash-body">' + WELCOME_MSG + '<br><button id="asthl-flash-cta">\u{1F4AC} \u091A\u0948\u091F \u0936\u0941\u0930\u0942 \u0915\u0930\u0947\u0902</button></div>';
  root.appendChild(flash);

  const win = document.createElement('div');
  win.id = 'asthl-chat-window';
  win.innerHTML = `
    <div id="asthl-chat-window-header">
      <div class="avatar">A</div>
      <div class="info">
        <div class="name">ASTHL AI RADAR</div>
        <div class="status"><span class="dot"></span> Online</div>
      </div>
      <button id="asthl-save-case-btn">💾 Save</button>
      <button id="asthl-cases-btn">📂 Cases</button>
      <button id=\"asthl-report-btn\">📄 Report</button>
      <button id="asthl-new-chat-btn">⟳ नयी चैट</button>
      <span class="close" id="asthl-chat-close">&times;</span>
    </div>
    <a id="asthl-wa-join" href="${WHATSAPP_URL}" target="_blank" rel="noopener">
      <svg viewBox="0 0 24 24" fill="#ffffff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.074-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      <span>WhatsApp ग्रुप से जुड़ें</span>
    </a>

    <div id="asthl-form-screen">

            <!-- STEP -1: ASTHL ID Gate -->
      <div id="asthl-step-gate" class="asthl-step" style="display:none">
        <h3>🔐 ASTHL Chat</h3>
        <p class="sub">प्रवेश के लिए अपना ASTHL ID डालें<br>(ID ASTHL से मिलता है)</p>
        <div class="asthl-form-group">
          <input id="asthl-access-id" type="text" placeholder="ASTHL ID" autocomplete="off" style="text-transform:uppercase;text-align:center;letter-spacing:1px" />
          <div class="asthl-gate-err" id="asthl-gate-err"></div>
          <button id="asthl-access-btn" class="asthl-btn-primary">प्रवेश करें →</button>
        </div>
        <p class="asthl-gate-note">ID नहीं है? कॉल/व्हाट्सप्प करें: <b>+91-7903873282</b></p>
      </div>

<!-- STEP 0: Category -->
      <div id="asthl-step-category" class="asthl-step">
        <h3>\u0928\u092E\u0938\u094D\u0924\u0947! \u0906\u092A \u0915\u094C\u0928 \u0939\u0948\u0902?</h3>
        <p class="sub">\u092A\u0939\u0932\u0947 \u0905\u092A\u0928\u0940 \u0936\u094D\u0930\u0947\u0923\u0940 \u091A\u0941\u0928\u0947\u0902</p>
        <div class="asthl-cat-grid">
          <button class="asthl-cat-btn" id="asthl-cat-patient">
            <span class="cat-icon">\u{1F469}\u200D\u2695\uFE0F</span>
            <span class="cat-title">\u092E\u0930\u0940\u095B</span>
            <span class="cat-sub">\u0938\u094D\u0935\u093E\u0938\u094D\u0925\u094D\u092F \u0938\u0935\u093E\u0932 \u092A\u0942\u091B\u0928\u093E \u0939\u0948</span>
          </button>
          <button class="asthl-cat-btn" id="asthl-cat-doctor">
            <span class="cat-icon">\u{1F3E5}</span>
            <span class="cat-title">\u0921\u0949\u0915\u094D\u091F\u0930</span>
            <span class="cat-sub">\u0939\u094B\u092E\u094D\u092F\u094B\u092A\u0925\u0940 \u092A\u094D\u0930\u0948\u0915\u094D\u091F\u093F\u0936\u0928\u0930</span>
          </button>
        </div>
        <div class="asthl-form-note">\u092A\u0939\u0932\u0940 \u092C\u093E\u0930 \u092A\u0902\u091C\u0940\u0930\u0923 \u092E\u0947\u0902 \u092E\u094B\u092C\u093E\u0907\u0932 OTP \u0938\u0947 \u0938\u0924\u094D\u092F\u093E\u092A\u0928 \u0939\u094B\u0917\u093E\u0964 \u0909\u0938\u0915\u0947 \u092C\u093E\u0926 \u092C\u093E\u0930-\u092C\u093E\u0930 OTP \u0928\u0939\u0940\u0902 \u0932\u0917\u0947\u0917\u093E\u0964</div>
      </div>

      <!-- STEP 1: Registration Form -->
      <div id="asthl-step-form" class="asthl-step" style="display:none">
        <h3 id="asthl-form-title">\u0935\u093F\u0935\u0930\u0923 \u092D\u0930\u0947\u0902</h3>
        <p class="sub" id="asthl-form-sub"></p>
        <div class="asthl-form-group">
          <label>\u0928\u093E\u092E *</label>
          <input type="text" id="asthl-pname" placeholder="\u0905\u092A\u0928\u093E \u092A\u0942\u0930\u093E \u0928\u093E\u092E" autocomplete="off">
          <div class="asthl-form-error" id="asthl-err-name">\u0915\u0943\u092A\u092F\u093E \u0928\u093E\u092E \u0926\u0930\u094D\u091C \u0915\u0930\u0947\u0902</div>
        </div>
        <div class="asthl-form-group">
          <label>\u0909\u092E\u094D\u0930 *</label>
          <input type="number" id="asthl-page" placeholder="\u0905\u092A\u0928\u0940 \u0909\u092E\u094D\u0930" autocomplete="off">
          <div class="asthl-form-error" id="asthl-err-age">\u0915\u0943\u092A\u092F\u093E \u0938\u0939\u0940 \u0909\u092E\u094D\u0930 \u0926\u0930\u094D\u091C \u0915\u0930\u0947\u0902</div>
        </div>
        <div class="asthl-form-group">
          <label>\u092E\u094B\u092C\u093E\u0907\u0932 \u0928\u0902\u092C\u0930 *</label>
          <input type="tel" id="asthl-pmobile" placeholder="10 digit mobile number" maxlength="10" autocomplete="off">
          <div class="asthl-form-error" id="asthl-err-mobile">\u0915\u0943\u092A\u092F\u093E \u0938\u0939\u0940 10 \u0905\u0902\u0915 \u0915\u093E \u0928\u0902\u092C\u0930 \u0926\u0930\u094D\u091C \u0915\u0930\u0947\u0902</div>
        </div>
        <div class="asthl-form-group" id="asthl-clinic-group" style="display:none">
          <label>\u0915\u094D\u0932\u093F\u0928\u093F\u0915 / \u0905\u0938\u094D\u092A\u0924\u093E\u0932 \u0915\u093E \u0928\u093E\u092E *</label>
          <input type="text" id="asthl-pclinic" placeholder="\u0905\u092A\u0928\u0947 \u0915\u094D\u0932\u093F\u0928\u093F\u0915 \u0915\u093E \u0928\u093E\u092E \u0932\u093F\u0916\u0947\u0902" autocomplete="off">
          <div class="asthl-form-error" id="asthl-err-clinic">\u0915\u0943\u092A\u092F\u093E \u0915\u094D\u0932\u093F\u0928\u093F\u0915 \u0915\u093E \u0928\u093E\u092E \u0926\u0930\u094D\u091C \u0915\u0930\u0947\u0902</div>
        </div>
        <div class="asthl-form-group">
          <label>\u092A\u0924\u093E *</label>
          <textarea id="asthl-paddress" rows="2" placeholder="\u0928\u0917\u0930, \u091C\u093F\u0932\u093E, \u0930\u093E\u091C\u094D\u092F \u0932\u093F\u0916\u0947\u0902" autocomplete="off"></textarea>
          <div class="asthl-form-error" id="asthl-err-address">\u0915\u0943\u092A\u092F\u093E \u092A\u0924\u093E \u0926\u0930\u094D\u091C \u0915\u0930\u0947\u0902</div>
        </div>
        <button id="asthl-form-submit" class="asthl-btn-primary">\u0913\u091F\u0940\u092A\u0940 \u092D\u0947\u091C\u0947\u0902 \u2192</button>
        <div style="text-align:center;margin-top:10px">
          <button class="asthl-link" id="asthl-back-cat">\u2190 \u0936\u094D\u0930\u0947\u0923\u0940 \u092C\u0926\u0932\u0947\u0902</button>
        </div>
      </div>

      <!-- STEP 2: OTP -->
      <div id="asthl-step-otp" class="asthl-step" style="display:none">
        <h3>\u092E\u094B\u092C\u093E\u0907\u0932 \u0938\u0924\u094D\u092F\u093E\u092A\u0928</h3>
        <div class="asthl-otp-status" id="asthl-otp-status">+91-XXXXXXX \u092A\u0930 OTP \u092D\u0947\u091C\u093E \u0917\u092F\u093E \u0939\u0948</div>
        <div class="asthl-form-group">
          <label>OTP \u0926\u0930\u094D\u091C \u0915\u0930\u0947\u0902 *</label>
          <input type="tel" id="asthl-otp-input" placeholder="- - - - - -" maxlength="6" autocomplete="one-time-code">
          <div class="asthl-form-error" id="asthl-err-otp">\u0917\u0932\u0924 OTP\u0964 \u0926\u094B\u092C\u093E\u0930\u093E \u0915\u094B\u0936\u093F\u0936 \u0915\u0930\u0947\u0902\u0964</div>
        </div>
        <button id="asthl-otp-verify" class="asthl-btn-primary">\u0938\u0924\u094D\u092F\u093E\u092A\u093F\u0924 \u0915\u0930\u0947\u0902 \u2713</button>
        <div class="asthl-otp-links">
          <button id="asthl-otp-back">\u2190 \u092A\u0940\u091B\u0947</button>
          <button id="asthl-otp-resend">\u0926\u094B\u092C\u093E\u0930\u093E \u092D\u0947\u091C\u0947\u0902</button>
        </div>
        <div class="asthl-form-note">\u092F\u0939 \u090F\u0915 \u092C\u093E\u0930 \u0939\u0940 \u0939\u094B\u0917\u093E \u2014 \u0905\u0917\u0932\u0940 \u092C\u093E\u0930 OTP \u0928\u0939\u0940\u0902 \u092E\u093E\u0902\u0917\u093E \u091C\u093E \u0924\u0915</div>
      </div>

      <!-- STEP 3: Returning user -->
      <div id="asthl-step-return" class="asthl-step" style="display:none">
        <h3>\u0928\u092E\u0938\u094D\u0924\u0947 \u092B\u093F\u0930 \u0938\u0947, <span id="asthl-ret-name"></span>! \u{1F44B}</h3>
        <p class="sub">\u0906\u092A \u092A\u0939\u0932\u0947 \u0938\u0947 \u0930\u091C\u093F\u0938\u094D\u091F\u0930 \u0939\u0948\u0902 \u2014 \u092C\u0938 \u091A\u0948\u091F \u0936\u0941\u0930\u0942 \u0915\u0930\u0947\u0902</p>
        <div class="asthl-return-card" id="asthl-ret-card"></div>
        <button id="asthl-ret-start" class="asthl-btn-primary">\u091A\u0948\u091F \u0936\u0941\u0930\u0942 \u0915\u0930\u0947\u0902 \u2192</button>
        <div style="text-align:center;margin-top:12px">
          <button class="asthl-link" id="asthl-ret-reset">\u0928\u092F\u093E \u092F\u0942\u091C\u093C\u0930 \u0939\u0948\u0902? \u0926\u094B\u092C\u093E\u0930\u093E \u0930\u091C\u093F\u0938\u094D\u091F\u0930 \u0915\u0930\u0947\u0902</button>
        </div>
      </div>

      <!-- reCAPTCHA -->
      <div id="asthl-recaptcha-container"></div>
    </div>

    <div id="asthl-chat-messages"></div>

    <div id="asthl-chat-input-area">
      <textarea id="asthl-chat-input" rows="1" placeholder="\u0905\u092A\u0928\u093E \u092A\u094D\u0930\u0936\u094D\u0928 \u0932\u093F\u0916\u0947\u0902... (r:, ias:, ai:, s+, m+, l+)"></textarea>
      <button id="asthl-mic-btn" title="बोलकर पूछें"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg></button>
      <button id="asthl-chat-send"><svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg></button>
    </div>

    <div id="asthl-chat-disclaimer">${DOCTOR_CONTACT}</div>
  `;
  root.appendChild(win);

  // ===== DOM refs =====
  const stepCat = document.getElementById('asthl-step-category');
  const stepForm = document.getElementById('asthl-step-form');
  const stepOtp = document.getElementById('asthl-step-otp');
  const stepReturn = document.getElementById('asthl-step-return');
  const formScreen = document.getElementById('asthl-form-screen');
  const msgContainer = document.getElementById('asthl-chat-messages');
  const inputArea = document.getElementById('asthl-chat-input-area');
  const input = document.getElementById('asthl-chat-input');
  const sendBtn = document.getElementById('asthl-chat-send');
  const formSubmit = document.getElementById('asthl-form-submit');
  const otpInput = document.getElementById('asthl-otp-input');
  const otpVerifyBtn = document.getElementById('asthl-otp-verify');
  const otpResendBtn = document.getElementById('asthl-otp-resend');
  const otpBackBtn = document.getElementById('asthl-otp-back');
  const otpStatus = document.getElementById('asthl-otp-status');
  const otpErr = document.getElementById('asthl-err-otp');

  function showStep(step) {
    stepGate.style.display = 'none';
    stepCat.style.display = 'none';
    stepForm.style.display = 'none';
    stepOtp.style.display = 'none';
    stepReturn.style.display = 'none';
    if (step) step.style.display = 'flex';
  }

  // ===== Helpers =====
  function scrollDown() { msgContainer.scrollTop = msgContainer.scrollHeight; }
  function addMsg(text, type) {
    const el = document.createElement('div');
    el.className = 'asthl-msg ' + type;
    el.textContent = text;
    msgContainer.appendChild(el);
    scrollDown();
  }
  function showTyping() {
    const el = document.createElement('div');
    el.className = 'asthl-typing';
    el.id = 'asthl-typing-indicator';
    el.innerHTML = '<span></span><span></span><span></span>';
    msgContainer.appendChild(el);
    scrollDown();
  }
  function hideTyping() {
    const el = document.getElementById('asthl-typing-indicator');
    if (el) el.remove();
  }
  function showError(id, show) {
    const el = document.getElementById(id);
    if (show) el.classList.add('show'); else el.classList.remove('show');
  }
  function hideAllErrors() {
    ['asthl-err-name','asthl-err-age','asthl-err-mobile','asthl-err-clinic','asthl-err-address'].forEach(function(id){ showError(id,false); });
  }

  // ===== Flash =====
  function showFlash() {
    if (isOpen) return;
    isFlashing = true;
    flash.classList.add('show');
    setTimeout(function() { if (isFlashing && !isOpen) hideFlash(); }, FLASH_AUTO_CLOSE);
  }
  function hideFlash() { flash.classList.remove('show'); isFlashing = false; }

  // ===== Open/close chat =====
  async function openChat() {
    // HTTP (insecure) page: Firebase OTP secure context maangta hai.
    // Isliye chat ko secure page par naye tab mein khol do.
    if (OTP_ENABLED && !FULLPAGE_MODE && !window.isSecureContext) {
      window.open(CHAT_PAGE_URL, '_blank');
      return;
    }
    isOpen = true; hideFlash(); win.classList.add('open');
    if (chatStarted) {
      formScreen.style.display = 'none';
      msgContainer.classList.add('show');
      inputArea.classList.add('show');
      setTimeout(function() { input.focus(); }, 300);
      return;
    }
    // Registration flow
    formScreen.style.display = 'flex';
    msgContainer.classList.remove('show');
    inputArea.classList.remove('show');
    // ===== Vercel page (FULLPAGE): login ID ZAROORI + har visit par server se verify =====
    if (FULLPAGE_MODE && !chatStarted) {
      var savedId = getAccessId();
      if (!savedId) { showStep(stepGate); return; }
      // saved ID ko server par active-list se verify karo
      showStep(stepGate);
      gateInput.value = savedId;
      gateBtn.disabled = true; gateBtn.textContent = 'जाँच हो रही है...';
      var vOk = false; var vExpired = false;
      try {
        var vRes = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ checkId: savedId }) });
        var vData = await vRes.json();
        vOk = vData.access === true; vExpired = (vData.expired === true);
      } catch (vErr) { vOk = false; }
      gateBtn.disabled = false; gateBtn.textContent = 'प्रवेश करें →';
      if (vOk) { startChat(); return; }
      // ID active nahi (hata di gayi) — purana login clear karo, dubara ID maango
      try { localStorage.removeItem('asthl_access_ok'); localStorage.removeItem('asthl_access_id'); } catch (vErr2) {}
      gateErr.textContent = vExpired ? 'आपकी ID की validity खतम हो गई है। Renewal के लिए संपर्क करें — कॉल/व्हाट्सप्प +91-7903873282' : 'आपकी ID अब active नहीं है। कृपया active ID डालें या ASTHL से संपर्क करें — कॉल/व्हाट्सप्प +91-7903873282';
      gateErr.classList.add('show');
      return;
    }
    var saved = loadSavedUser();
    if (saved) {
      patientInfo = saved;
      fillReturnCard(saved);
      showStep(stepReturn);
    } else {
      showStep(stepCat);
    }
  }
  function closeChat() { isOpen = false; win.classList.remove('open'); }

  function fillReturnCard(u) {
    document.getElementById('asthl-ret-name').textContent = u.name;
    var cat = u.category === 'doctor' ? '\u0921\u0949\u0915\u094D\u091F\u0930' : '\u092E\u0930\u0940\u095B';
    var html = '<div class="row"><span class="k">\u0928\u093E\u092E</span><span class="v">' + u.name + '</span></div>';
    html += '<div class="row"><span class="k">\u092E\u094B\u092C\u093E\u0907\u0932</span><span class="v green">+91-' + u.mobile + ' \u2713</span></div>';
    html += '<div class="row"><span class="k">\u0936\u094D\u0930\u0947\u0923\u0940</span><span class="v">' + cat + '</span></div>';
    if (u.category === 'doctor' && u.clinic) html += '<div class="row"><span class="k">\u0915\u094D\u0932\u093F\u0928\u093F\u0915</span><span class="v">' + u.clinic + '</span></div>';
    if (u.address) html += '<div class="row"><span class="k">\u092A\u0924\u093E</span><span class="v">' + u.address + '</span></div>';
    document.getElementById('asthl-ret-card').innerHTML = html;
  }

  // ===== Category selection =====
  var selectedCategory = null;

  document.getElementById('asthl-cat-patient').addEventListener('click', function() {
    selectedCategory = 'patient';
    document.getElementById('asthl-form-title').textContent = '\u092E\u0930\u0940\u095B \u2014 \u0935\u093F\u0935\u0930\u0923 \u092D\u0930\u0947\u0902';
    document.getElementById('asthl-form-sub').textContent = '\u092A\u0922\u093C\u0947\u0947 \u0939\u0941\u090F \u0938\u0935\u093E\u0932\u094B\u0902 \u0915\u0947 \u0932\u093F\u090F \u0938\u0930\u0932 \u091C\u0935\u093E\u092C \u092E\u093F\u0932\u0947\u0902\u0917\u0947';
    document.getElementById('asthl-clinic-group').style.display = 'none';
    showStep(stepForm);
  });

  document.getElementById('asthl-cat-doctor').addEventListener('click', function() {
    selectedCategory = 'doctor';
    document.getElementById('asthl-form-title').textContent = '\u0921\u0949\u0915\u094D\u091F\u0930 \u2014 \u0935\u093F\u0935\u0930\u0923 \u092D\u0930\u0947\u0902';
    document.getElementById('asthl-form-sub').textContent = '\u0924\u0915\u0928\u0940\u0915\u0940 \u0935\u093F\u0938\u094D\u0924\u0943\u0924 \u0938\u092E\u091D \u092E\u093F\u0932\u0947\u0917\u0940 \u2014 rubric, Materia Medica \u0906\u0926\u093F';
    document.getElementById('asthl-clinic-group').style.display = 'block';
    showStep(stepForm);
  });

  document.getElementById('asthl-back-cat').addEventListener('click', function() {
    showStep(stepCat);
  });

  // ===== FIREBASE =====
  async function initFirebase() {
    try {
      const appMod = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
      const authMod = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
      const app = appMod.initializeApp(FIREBASE_CONFIG);
      fbAuth = authMod.getAuth(app);
      fbAuthMod = authMod;
      return true;
    } catch (err) {
      console.error('Firebase init failed:', err);
      return false;
    }
  }

  async function sendOTP(mobile) {
    if (!fbAuth || !fbAuthMod) {
      const ok = await initFirebase();
      if (!ok) throw new Error('Firebase config error');
    }
    if (!recaptchaVerifier) {
      recaptchaVerifier = new fbAuthMod.RecaptchaVerifier(fbAuth, 'asthl-recaptcha-container', { size: 'invisible' });
      await recaptchaVerifier.render();
    }
    confirmationResult = await fbAuthMod.signInWithPhoneNumber(fbAuth, '+91' + mobile, recaptchaVerifier);
    return true;
  }

  async function verifyOTP(code) {
    if (!confirmationResult) throw new Error('Pehle OTP bhejein.');
    return await confirmationResult.confirm(code);
  }

  // ===== Form submit =====
  async function handleFormSubmit() {
    const name = document.getElementById('asthl-pname').value.trim();
    const age = document.getElementById('asthl-page').value.trim();
    const mobile = document.getElementById('asthl-pmobile').value.trim();
    const clinic = document.getElementById('asthl-pclinic').value.trim();
    const address = document.getElementById('asthl-paddress').value.trim();

    hideAllErrors();
    let valid = true;
    if (!name || name.length < 2) { showError('asthl-err-name', true); valid = false; }
    if (!age || isNaN(age) || parseInt(age) < 1 || parseInt(age) > 120) { showError('asthl-err-age', true); valid = false; }
    if (!mobile || !/^\d{10}$/.test(mobile)) { showError('asthl-err-mobile', true); valid = false; }
    if (selectedCategory === 'doctor' && (!clinic || clinic.length < 2)) { showError('asthl-err-clinic', true); valid = false; }
    if (!address || address.length < 5) { showError('asthl-err-address', true); valid = false; }
    if (!valid) return;

    var newUser = { name: name, age: age, mobile: mobile, address: address, category: selectedCategory, clinic: selectedCategory === 'doctor' ? clinic : '', verified: false };

    if (!OTP_ENABLED || !window.isSecureContext) {
      // HTTP par Firebase OTP nahi chalta — insecure context.
      // Patient ko block karne ke bajaye unverified register kar do.
      // HTTPS aane par (Cloudflare) OTP apne aap active ho jayega.
      patientInfo = newUser;
      patientInfo.verified = window.isSecureContext ? false : false;
      saveUser(newUser);
      startChat();
      return;
    }

    formSubmit.disabled = true;
    formSubmit.textContent = 'OTP \u092D\u0947\u091C \u0930\u0939\u093E \u0939\u0948...';

    try {
      await sendOTP(mobile);
      patientInfo = newUser;
      otpStatus.textContent = '+91-' + mobile + ' \u092A\u0930 6 \u0905\u0902\u0915 \u0915\u093E OTP \u092D\u0947\u091C\u093E \u0917\u092F\u093E \u0939\u0948\u0964 SMS \u0926\u0947\u0916\u0915\u0930 \u0928\u0940\u091A\u0947 \u0921\u093E\u0932\u0947\u0902\u0964';
      otpErr.classList.remove('show');
      otpInput.value = '';
      showStep(stepOtp);
      startResendCooldown(60);
      setTimeout(function() { otpInput.focus(); }, 200);
    } catch (err) {
      console.error('OTP send failed:', err);
      var msg = 'OTP \u0928\u0939\u0940\u0902 \u092D\u0947\u091C \u092A\u093E \u0930\u0939\u093E\u0964 \u0925\u094B\u0921\u093C\u0940 \u0926\u0947\u0930 \u092C\u093E\u0926 \u092A\u094D\u0930\u092F\u093E\u0938 \u0915\u0930\u0947\u0902\u0964';
      if (err.code === 'auth/too-many-requests') msg = '\u092C\u0939\u0941\u0924 \u091C\u094D\u092F\u093E\u0926\u093E OTP \u092D\u0947\u091C\u093E \u0917\u092F\u093E\u0964 \u0915\u0941\u091B \u0926\u0947\u0930 \u092C\u093E\u0926 \u0915\u094B\u0936\u093F\u0936 \u0915\u0930\u0947\u0902\u0964';
      if (err.code === 'auth/invalid-phone-number') msg = '\u0917\u0932\u0924 \u092E\u094B\u092C\u093E\u0907\u0932 \u0928\u0902\u092C\u0930\u0964';
      if (err.code === 'auth/unauthorized-domain') msg = '\u092F\u0939 domain Firebase mein authorized \u0928\u0939\u0940\u0902 \u0939\u0948\u0964';
      if ((err.code || '').indexOf('billing') !== -1 || (err.message || '').indexOf('BILLING_NOT_ENABLED') !== -1) {
        msg = 'Firebase billing account link karna zaroori hai (naya rule). Firebase Console > Usage and billing > Blaze plan (10 SMS/day ab bhi free).';
      }
      // reCAPTCHA reset — warna retry par wahi error aata rahega
      if (recaptchaVerifier) { try { recaptchaVerifier.clear(); } catch (e2) {} recaptchaVerifier = null; }
      alert(msg + '\n\n[Error: ' + (err.code || err.message || 'unknown') + ']');
    } finally {
      formSubmit.disabled = false;
      formSubmit.textContent = '\u0913\u091F\u0940\u092A\u0940 \u092D\u0947\u091C\u0947\u0902 \u2192';
    }
  }

  // ===== OTP verify =====
  async function handleOtpVerify() {
    const code = otpInput.value.trim();
    if (!code || !/^\d{6}$/.test(code)) {
      otpErr.textContent = '\u0915\u0943\u092A\u092F\u093E 6 \u0905\u0902\u0915 \u0915\u093E OTP \u0921\u093E\u0932\u0947\u0902\u0964';
      otpErr.classList.add('show');
      return;
    }
    otpVerifyBtn.disabled = true;
    otpVerifyBtn.textContent = '\u091C\u093E\u0901\u091A \u0939\u094B \u0930\u0939\u0940 \u0939\u0948...';
    otpErr.classList.remove('show');

    try {
      await verifyOTP(code);
      patientInfo.verified = true;
      patientInfo.registeredAt = new Date().toISOString();
      saveUser(patientInfo);
      startChat();
    } catch (err) {
      if (err.code === 'auth/invalid-verification-code') {
        otpErr.textContent = '\u0917\u0932\u0924 OTP\u0964 \u0926\u094B\u092C\u093E\u0930\u093E \u0915\u094B\u0936\u093F\u0936 \u0915\u0930\u0947\u0902\u0964';
      } else if (err.code === 'auth/code-expired') {
        otpErr.textContent = 'OTP \u0938\u092E\u093E\u092A\u094D\u0924 \u0939\u094B \u0917\u092F\u093E\u0964 \u0926\u094B\u092C\u093E\u0930\u093E \u092D\u0947\u091C\u0947\u0902\u0964';
      } else {
        otpErr.textContent = '\u0924\u094D\u0930\u0941\u091F\u093F: ' + (err.message || 'fail');
      }
      otpErr.classList.add('show');
      otpInput.value = '';
      otpInput.focus();
    } finally {
      otpVerifyBtn.disabled = false;
      otpVerifyBtn.textContent = '\u0938\u0924\u094D\u092F\u093E\u092A\u093F\u0924 \u0915\u0930\u0947\u0902 \u2713';
    }
  }

  function startResendCooldown(sec) {
    otpCooldown = sec;
    otpResendBtn.disabled = true;
    clearInterval(resendTimer);
    resendTimer = setInterval(function() {
      otpCooldown--;
      if (otpCooldown <= 0) {
        clearInterval(resendTimer);
        otpResendBtn.disabled = false;
        otpResendBtn.textContent = '\u0926\u094B\u092C\u093E\u0930\u093E \u092D\u0947\u091C\u0947\u0902';
      } else {
        otpResendBtn.textContent = '\u0926\u094B\u092C\u093E\u0930\u093E \u092D\u0947\u091C\u0947\u0902 (' + otpCooldown + 's)';
      }
    }, 1000);
    otpResendBtn.textContent = '\u0926\u094B\u092C\u093E\u0930\u093E \u092D\u0947\u091C\u0947\u0902 (' + otpCooldown + 's)';
  }

  async function handleOtpResend() {
    try {
      await sendOTP(patientInfo.mobile);
      otpErr.classList.remove('show');
      otpInput.value = '';
      otpInput.focus();
      startResendCooldown(60);
    } catch (err) {
      alert('OTP \u0928\u0939\u0940\u0902 \u092D\u0947\u091C \u092A\u093E \u0930\u0939\u093E\u0964 \u0925\u094B\u0921\u093C\u0940 \u0926\u0947\u0930 \u092C\u093E\u0926 \u092A\u094D\u0930\u092F\u093E\u0938 \u0915\u0930\u0947\u0902\u0964');
    }
  }

  function handleOtpBack() {
    showStep(stepForm);
    clearInterval(resendTimer);
  }


  // ===== v37: HEALTH ALERT POPUP (sheet se — patient/doctor) =====
  function asthlHash(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; } return Math.abs(h); }
  function asthlImgUrl(u) {
    u = String(u || '').trim(); if (!u) return '';
    var m = u.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w1200';
    m = u.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
    if (m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w1200';
    m = u.match(/drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/);
    if (m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w1200';
    return u;
  }
  function showHealthAlert(audience) {
    try {
      fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'getHealthAlert', audience: audience }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || d.status !== 'ok' || !d.alert || !d.alert.title) return;
          var a = d.alert;
          var key = 'asthl_ha_' + asthlHash(a.title + '|' + a.text) + '_' + new Date().toISOString().slice(0, 10);
          try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1'); } catch (e) {}
          var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&' + 'amp;', '<': '&' + 'lt;', '>': '&' + 'gt;', '"': '&' + 'quot;', "'": '&' + '#39;' }[c]; }); };
          var img = asthlImgUrl(a.image);
          var ov = document.createElement('div');
          ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.62);z-index:1000001;display:flex;align-items:center;justify-content:center;padding:16px;';
          var card = document.createElement('div');
          card.style.cssText = 'background:#fff;border-radius:20px;max-width:420px;width:100%;max-height:88vh;overflow-y:auto;position:relative;font-family:inherit;';
          card.innerHTML =
            '<div id="asthl-ha-close" style="position:absolute;top:8px;right:8px;width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,.55);color:#fff;font-size:19px;line-height:32px;text-align:center;cursor:pointer;z-index:2;">\u00D7</div>'
            + (img ? '<img src="' + esc(img) + '" alt="" style="width:100%;display:block;max-height:230px;object-fit:cover;">' : '')
            + '<div style="padding:16px 18px 18px;">'
            + '<h3 style="margin:0 0 8px;font-size:17px;color:#134e4a;line-height:1.4;">' + esc(a.title) + '</h3>'
            + (a.text ? '<p style="margin:0;font-size:13.5px;color:#334155;line-height:1.65;">' + esc(a.text) + '</p>' : '')
            + '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">'
            + (a.knowMore ? '<a href="' + esc(a.knowMore) + '" target="_blank" rel="noopener" style="flex:1;min-width:130px;text-align:center;background:#0d9488;color:#fff;border-radius:12px;padding:10px 8px;font-size:13.5px;font-weight:700;text-decoration:none;">Know More \u2192</a>' : '')
            + '<a href="tel:+917903873282" style="flex:1;min-width:100px;text-align:center;background:#166534;color:#fff;border-radius:12px;padding:10px 8px;font-size:13.5px;font-weight:700;text-decoration:none;">\U0001F4DE Call</a>'
            + '<a href="https://wa.me/917903873282" target="_blank" rel="noopener" style="flex:1;min-width:100px;text-align:center;background:#16a34a;color:#fff;border-radius:12px;padding:10px 8px;font-size:13.5px;font-weight:700;text-decoration:none;">\U0001F4AC WhatsApp</a>'
            + '</div>'
            + '<p style="font-size:12px;color:#64748b;margin:12px 0 0;text-align:center;line-height:1.5;">\u0905\u0917\u0930 \u0906\u092A\u0915\u094B \u0910\u0938\u0940 \u0915\u094B\u0908 \u0938\u092E\u0938\u094D\u092F\u093E \u0939\u0948 \u0924\u094B ASTHL \u092A\u0930 Call / WhatsApp \u0915\u0930\u0947\u0902: <b>+91-7903873282</b></p>'
            + '</div>';
          ov.appendChild(card);
          document.body.appendChild(ov);
          var close = function () { ov.remove(); };
          card.querySelector('#asthl-ha-close').addEventListener('click', close);
          ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
        }).catch(function () {});
    } catch (e) {}
  }

  // ===== Start chat =====
  function startChat() {
    chatStarted = true;
    showHealthAlert(FULLPAGE_MODE ? 'doctor' : 'patient');
    // v44: doctor ke liye pending case flash / accept-reject / reminder
    var _aid = getAccessId();
    if (_aid) {
      setTimeout(function () { showEarnBanner(_aid); }, 1800);
      setTimeout(function () { checkAssignments(_aid); }, 3500);
    }
    newChatBtn.style.display = 'block';
    if (FULLPAGE_MODE) {
      document.getElementById('asthl-save-case-btn').style.display = 'inline-block';
      document.getElementById('asthl-cases-btn').style.display = 'inline-block';
      document.getElementById('asthl-report-btn').style.display = 'inline-block';
    }
    clearInterval(resendTimer);
    buildMessages();
    formScreen.style.display = 'none';
    msgContainer.classList.add('show');
    inputArea.classList.add('show');
    var cat = (patientInfo && patientInfo.category === 'doctor') ? '\u0921\u0949\u0915\u094D\u091F\u0930' : '\u092E\u0930\u0940\u095B';
    var extra = patientInfo && patientInfo.category === 'doctor' && patientInfo.clinic ? '\u0905\u092A\u0928\u0947 \u0915\u094D\u0932\u093F\u0928\u093F\u0915 \u0938\u0947 \u092C\u093E\u0924 \u0915\u0930\u0924\u0947 \u0939\u0948\u0902\u0964 ' : '';
    var welcome;
    if (!patientInfo) {
      welcome = 'नमस्ते! 🙏 मैं ASTHL होम्योपथी असिस्टेंट हूँ। अपना सवाल पूछें — केस विश्लेषण, रूब्रिक, मैटेरिया मेडिका आदि।';
    } else if (patientInfo.category === 'doctor') {
          var welcome = '\u0928\u092E\u0938\u094D\u0924\u0947 ' + patientInfo.name + '! \u{1F64F} \u0906\u092A ' + cat + ' \u0930\u0942\u092A \u092E\u0947\u0902 \u0930\u091C\u093F\u0938\u094D\u091F\u0930 \u0939\u0948\u0902\u0964 ' + extra + '\u0905\u092A\u0928\u093E \u0938\u0935\u093E\u0932 \u092A\u0942\u091B\u0947\u0902 \u2014 \u0930\u0942\u092C\u094D\u0930\u093F\u0915 \u090F\u0928\u093E\u0932\u093F\u0938\u093F\u0938, \u092E\u0948\u091F\u0947\u0930\u093F\u092F\u093E \u092E\u0947\u0921\u093F\u0915\u093E, \u0930\u0947\u092E\u0947\u0921\u0940 \u0924\u0941\u0932\u0928\u093E \u0906\u0926\u093F\u0964 r:, ias:, ai:, s+, m+, l+ \u092A\u094D\u0930\u0940\u092B\u093F\u0915\u094D\u0938 \u092D\u0940 \u0909\u092A\u092F\u094B\u0917 \u0915\u0930 \u0938\u0915\u0924\u0947 \u0939\u0948\u0902\u0964';
    } else {
      welcome = 'नमस्ते ' + patientInfo.name + '! 🙏 आप मरीज़ रूप में रजिस्टर हैं। अपनी समस्या आसान भाषा में बताइए — मैं आपके लक्षणों के अनुसार एक होम्योपथिक दवा सुझाऊँगा। गंभीर लक्षण हों तो कृपया ASTHL के डॉक्टर्स से बात करें — कॉल/व्हाट्सप्प +91-7903873282।';
      input.placeholder = 'अपनी समस्या या लक्षण आसान शब्दों में लिखें...';
    }
    addMsg(welcome, 'bot');
    setTimeout(function() { input.focus(); }, 300);
  }

  // ===== Returning user =====
  document.getElementById('asthl-ret-start').addEventListener('click', function() {
    startChat();
  });
  document.getElementById('asthl-ret-reset').addEventListener('click', function() {
    clearUser();
    patientInfo = null;
    showStep(stepCat);
  });

  // ===== Events =====
  btn.addEventListener('click', function() { if (isOpen) closeChat(); else openChat(); });
  // WhatsApp group: ek click ke baad button hide (galti se dobara click na ho)
  var waBtn = document.getElementById('asthl-wa-join');
  if (localStorage.getItem('asthl_wa_done')) { waBtn.style.display = 'none'; }
  waBtn.addEventListener('click', function() {
    localStorage.setItem('asthl_wa_done', '1');
    waBtn.style.display = 'none';
  });


  // ===== ID GATE: ASTHL ID check =====
  var stepGate = document.getElementById('asthl-step-gate');
  var gateBtn = document.getElementById('asthl-access-btn');
  var gateInput = document.getElementById('asthl-access-id');
  var gateErr = document.getElementById('asthl-gate-err');
  function openAfterGate() {
    var saved = loadSavedUser();
    if (saved) { patientInfo = saved; fillReturnCard(saved); showStep(stepReturn); }
    else { showStep(stepCat); }
  }
  async function handleGate() {
    var idv = gateInput.value.trim().toUpperCase();
    gateErr.classList.remove('show');
    if (!idv) { gateErr.textContent = '\u0915\u0943\u092A\u092F\u093E ASTHL ID \u0921\u093E\u0932\u0947\u0902\u0964'; gateErr.classList.add('show'); return; }
    gateBtn.disabled = true; gateBtn.textContent = '\u091C\u093E\u0901\u091A \u0939\u094B \u0930\u0939\u0940 \u0939\u0948...';
    try {
      var res = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ checkId: idv }) });
      var data = await res.json();
      if (data.access === true) {
        localStorage.setItem('asthl_access_ok', '1');
        localStorage.setItem('asthl_access_id', idv);
        if (FULLPAGE_MODE) { patientInfo = null; startChat(); } else { openAfterGate(); }
      } else {
        gateErr.textContent = data.expired ? '\u0906\u092A\u0915\u0940 ID \u0915\u0940 validity \u0916\u0924\u092E \u0939\u094B \u0917\u0908 \u0939\u0948\u0964 Renewal \u0915\u0947 \u0932\u093F\u090F \u0938\u0902\u092A\u0930\u094D\u0915 \u0915\u0930\u0947\u0902 \u2014 \u0915\u0949\u0932/\u0935\u094D\u0939\u093E\u091F\u094D\u0938\u092A\u094D\u092A +91-7903873282' : '\u0917\u0932\u0924 ID\u0964 \u0938\u0939\u0940 ID \u0921\u093E\u0932\u0947\u0902 \u092F\u093E ASTHL \u0938\u0947 \u0938\u0902\u092A\u0930\u094D\u0915 \u0915\u0930\u0947\u0902 \u2014 \u0915\u0949\u0932/\u0935\u094D\u0939\u093E\u091F\u094D\u0938\u092A\u094D\u092A +91-7903873282';
        gateErr.classList.add('show');
      }
    } catch (err) {
      gateErr.textContent = '\u0915\u0928\u0947\u0915\u094D\u0936\u0928 \u0924\u094D\u0930\u0941\u091F\u093F\u0964 \u0925\u094B\u0921\u093C\u0940 \u0926\u0947\u0930 \u092C\u093E\u0926 \u0915\u094B\u0936\u093F\u0936 \u0915\u0930\u0947\u0902\u0964';
      gateErr.classList.add('show');
    } finally {
      gateBtn.disabled = false; gateBtn.textContent = '\u092A\u094D\u0930\u0935\u0947\u0936 \u0915\u0930\u0947\u0902 \u2192';
    }
  }
  gateBtn.addEventListener('click', handleGate);
  gateInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); handleGate(); } });

  // ===== VOICE INPUT: mic se sawal poocho (browser built-in, free) =====
  var micBtn = document.getElementById('asthl-mic-btn');
  var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  var recognition = null, isListening = false;
  var voiceTimer = null;
  var voicePre = '';
  var voicePhrases = [];
  // v31: phrase commit + revision detection (Android correction handling)
  function voiceIsRevision(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.indexOf(b) !== -1 || b.indexOf(a) !== -1) return true;
    var wa = a.split(' '), wb = b.split(' ');
    var pool = {}, common = 0, i;
    for (i = 0; i < wa.length; i++) pool[wa[i]] = (pool[wa[i]] || 0) + 1;
    for (i = 0; i < wb.length; i++) { if (pool[wb[i]] > 0) { pool[wb[i]]--; common++; } }
    var mx = Math.max(wa.length, wb.length);
    return mx > 0 && (common / mx) >= 0.5;
  }
  function voiceCommit(f) {
    if (!voicePhrases.length) { voicePhrases.push(f); return; }
    var joined = voicePhrases.join(' ');
    if (f === joined) return;                        // poora duplicate — chhodo
    if (joined.indexOf(f) !== -1) return;            // stale/partial — pehle se shamil hai
    if (f.indexOf(joined) !== -1) { voicePhrases = [f]; return; } // Android full-sentence revision/extension — SAB replace karo
    if (voiceIsRevision(joined, f) && f.length >= joined.length) { voicePhrases = [f]; return; } // word-level correction — sab replace
    var q, last = voicePhrases[voicePhrases.length - 1];
    for (q = 0; q < voicePhrases.length - 1; q++) {  // PURANE phrases ka stale-revision — chhodo
      if (voicePhrases[q].indexOf(f) !== -1) return;
      if (f.length <= voicePhrases[q].length && voiceIsRevision(voicePhrases[q], f)) return;
    }
    if (voiceIsRevision(last, f)) { voicePhrases[voicePhrases.length - 1] = (f.length >= last.length ? f : last); return; } // sirf aakhri phrase ka correction — REPLACE
    voicePhrases.push(f);
  }

  if (SpeechRec) {
    recognition = new SpeechRec();
    recognition.lang = 'hi-IN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = function(e) {
      // v32 ENGINE: HAR final result ko alag-alag commit karo (Android ek event me purana+revised dono bhejta hai)
      var interim = '';
      for (var k = 0; k < e.results.length; k++) {
        if (e.results[k].isFinal) {
          var ft = (e.results[k][0].transcript || '').replace(/\s+/g, ' ').trim();
          if (ft) voiceCommit(ft);
        } else { interim += e.results[k][0].transcript; }
      }
      input.value = [voicePre, voicePhrases.join(' '), interim.replace(/\s+/g, ' ').trim()].filter(Boolean).join(' ').replace(/\s+/g, ' ');
      input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 150) + 'px';
    };
    recognition.onend = function() {
      input.value = [voicePre, voicePhrases.join(' ')].filter(Boolean).join(' ').replace(/\s+/g, ' ');
      if (isListening) { try { recognition.start(); return; } catch (e5) {} }
      isListening = false; micBtn.classList.remove('listening'); if (input.dataset.ph) input.placeholder = input.dataset.ph;
    };
    recognition.onerror = function() { isListening = false; micBtn.classList.remove('listening'); };
    micBtn.addEventListener('click', function() {
      if (isListening) { isListening = false; clearTimeout(voiceTimer); try { recognition.stop(); } catch (e3) {} return; }
      try {
        input.dataset.ph = input.placeholder;
        input.placeholder = '\u0938\u0941\u0928 \u0930\u0939\u093E \u0939\u0942\u0901... \u092C\u094B\u0932\u0924\u0947 \u0930\u0939\u0947\u0902 \u2014 \u0930\u094B\u0915\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u092E\u093E\u0907\u0915 \u092A\u0930 \u0926\u094B\u092C\u093E\u0930\u093E \u0926\u092C\u093E\u090F\u0901';
        isListening = true;
        micBtn.classList.add('listening');
        voicePre = input.value ? input.value.replace(/\s+$/g, '') : '';
        voicePhrases = [];
        recognition.start();
        voiceTimer = setTimeout(function() { isListening = false; try { recognition.stop(); } catch (e6) {} }, 120000);
      } catch (e4) {}
    });
  } else {
    micBtn.style.display = 'none';
  }
  document.getElementById('asthl-flash-close').addEventListener('click', hideFlash);
  document.getElementById('asthl-flash-cta').addEventListener('click', openChat);
  document.getElementById('asthl-chat-close').addEventListener('click', closeChat);
  var newChatBtn = document.getElementById('asthl-new-chat-btn');
  newChatBtn.addEventListener('click', function() {
    if (!chatStarted) return;
    var ok = confirm('\u0928\u0908 \u091a\u0948\u091f \u0936\u0941\u0930\u0942 \u0915\u0930\u0947\u0902?\n\n\u092a\u0941\u0930\u093e\u0928\u0940 \u092c\u093e\u0924\u091a\u0940\u0924 \u0915\u093e \u0938\u0902\u0926\u0930\u094d\u092d \u0939\u091f \u091c\u093e\u090f\u0917\u093e \u2014 AI \u0915\u094b \u0907\u0938 \u091a\u0948\u091f \u0915\u0940 \u092c\u093e\u0924\u0947\u0902 \u092f\u093e\u0926 \u0928\u0939\u0940\u0902 \u0930\u0939\u0947\u0902\u0917\u0940\u0964');
    if (!ok) return;
    SESSION_ID = 'P' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    loadedCaseId = null;
    window._asthlAutoSave = false;
    var cs = document.getElementById('asthl-case-strip'); if (cs) cs.style.display = 'none';
    buildMessages();
    msgContainer.innerHTML = '';
    addMsg('\u0928\u0908 \u091a\u0948\u091f \u0936\u0941\u0930\u0942 \u0939\u0941\u0908 🔄\n\u0905\u092c \u092e\u0948\u0902 \u092a\u093f\u091b\u0932\u0940 \u092c\u093e\u0924\u091a\u0940\u0924 \u0928\u0939\u0940\u0902 \u091c\u093e\u0928\u0924\u093e \u2014 \u0905\u092a\u0928\u093e \u0928\u092f\u093e \u0938\u0935\u093e\u0932 \u092a\u0942\u091b\u0947\u0902\u0964', 'bot');
    input.focus();
  });
  formSubmit.addEventListener('click', handleFormSubmit);
  otpVerifyBtn.addEventListener('click', handleOtpVerify);
  otpResendBtn.addEventListener('click', handleOtpResend);
  otpBackBtn.addEventListener('click', handleOtpBack);

  document.getElementById('asthl-pmobile').addEventListener('input', function(e) {
    e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
  });
  otpInput.addEventListener('input', function(e) {
    e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
    otpErr.classList.remove('show');
  });
  otpInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); handleOtpVerify(); }
  });
  ['asthl-pname', 'asthl-page', 'asthl-pmobile', 'asthl-pclinic', 'asthl-paddress'].forEach(function(id) {
    document.getElementById(id).addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && id !== 'asthl-paddress') { e.preventDefault(); handleFormSubmit(); }
    });
  });

  input.addEventListener('input', function() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 150) + 'px'; });
  input.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } });
  sendBtn.addEventListener('click', sendMsg);

  // ===== Send message =====
  async function sendMsg() {
    var text = input.value.trim();
    if (!text) return;
    sendBtn.disabled = true; input.value = ''; input.style.height = 'auto';
    addMsg(text, 'user');
    messages.push({ role: 'user', parts: [{ text: text }] });
    showTyping();
    try {
      var payload = {
        messages: messages,
        sessionId: SESSION_ID,
        patientName: patientInfo ? patientInfo.name : '',
        patientAge: patientInfo ? patientInfo.age : '',
        patientMobile: patientInfo ? patientInfo.mobile : '',
        mobileVerified: patientInfo ? patientInfo.verified : false,
        accessId: (typeof localStorage !== 'undefined' ? (localStorage.getItem('asthl_access_id') || '') : ''),
        category: patientInfo ? patientInfo.category : '',
        clinic: patientInfo ? patientInfo.clinic : '',
        address: patientInfo ? patientInfo.address : ''
      };
      var res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) { var err = await res.json().catch(function() { return {}; }); throw new Error(err.error || 'Server error'); }
      var data = await res.json();
      var reply = data.reply || '\u0915\u094D\u0937\u092E\u093E \u0915\u0930\u0947\u0902, \u0926\u094B\u092C\u093E\u0930\u093E \u092A\u094D\u0930\u092F\u093E\u0938 \u0915\u0930\u0947\u0902\u0964';
      // MEDICINE-LIST tag: display/history se hatao, sheet me log karo
      var medListM = String(reply).match(/MEDICINE-LIST\s*:\s*([^\n]+)/i);
      if (medListM) {
        reply = String(reply).replace(/\n?MEDICINE-LIST\s*:[^\n]*/i, '').trim();
        var medList = medListM[1].split('|').map(function (s) { return s.replace(/^[\s\d.)*-]+/, '').trim(); }).filter(Boolean).join(', ');
        if (medList) {
          try {
            fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'saveMedSelection', source: 'Doctor', name: (patientInfo && patientInfo.name) || '', mobile: (patientInfo && patientInfo.mobile) || '', caseId: loadedCaseId || '', medicines: medList }) }).catch(function () {});
          } catch (e) {}
        }
      }
      addMsg(reply, 'bot');
      messages.push({ role: 'model', parts: [{ text: reply }] });
      queueAutoSave();
    } catch (err) {
      hideTyping();
      addMsg('\u0924\u094D\u0930\u0941\u091F\u093F: ' + err.message + '. \u0925\u094B\u0921\u093C\u0940 \u0926\u0947\u0930 \u092C\u093E\u0926 \u092A\u094D\u0930\u092F\u093E\u0938 \u0915\u0930\u0947\u0902\u0964', 'error');
    } finally {
      hideTyping(); sendBtn.disabled = false; input.focus();
    }
  }

  // ===== CASE FILES: save + load (sirf Vercel page) =====
  var saveCaseBtn = document.getElementById('asthl-save-case-btn');
  var casesBtn = document.getElementById('asthl-cases-btn');
  var loadedCaseId = null;
  var reportBtn = document.getElementById('asthl-report-btn');
  if (reportBtn) reportBtn.addEventListener('click', function() {
    if (messages.length < 3) { alert('पहले कोई चैट/केस करें — रिपोर्ट बनाने के लिए कुछ होना चाहिए।'); return; }
    var caseId = loadedCaseId || '(नी चैट)';
    var rn = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    var rh = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>ASTHL Case Report</title>'
      + '<style>body{font-family:Arial,"Noto Sans Devanagari",sans-serif;padding:28px;color:#1e293b;max-width:800px;margin:0 auto;}'
      + '.hd{border-bottom:3px solid #0d9488;padding-bottom:12px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;}'
      + '.hd h1{color:#0d9488;margin:0;font-size:22px;} .hd .sub{color:#64748b;font-size:12px;margin-top:4px;}'
      + '.meta{background:#f0fdfa;border:1px solid #ccfbf1;border-radius:8px;padding:10px 14px;margin-bottom:18px;font-size:13px;line-height:1.7;}'
      + '.msg{border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;margin:10px 0;font-size:13.5px;line-height:1.7;white-space:pre-wrap;word-wrap:break-word;}'
      + '.msg b{color:#0d9488;} .u{background:#f8fafc;}'
      + '.ft{margin-top:24px;border-top:1px solid #cbd5e1;padding-top:10px;color:#64748b;font-size:11px;line-height:1.6;}</style></head><body>'
      + '<div class="hd"><div><h1>🌿 ASTHL — A Step Towards Healthy Life</h1><div class="sub">Homeopathy Case Analysis Report</div></div>'
      + '<div style="text-align:right;font-size:12px;color:#64748b;"><b>' + caseId + '</b><br>' + rn + '</div></div>'
      + '<div class="meta"><b>Login ID:</b> ' + getAccessId() + ' &nbsp;|&nbsp; <b>Report Date:</b> ' + rn + '</div>';
    for (var i = 1; i < messages.length; i++) {
      var t = messages[i] && messages[i].parts && messages[i].parts[0] ? messages[i].parts[0].text : '';
      if (!t) continue;
      var esc = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      rh += '<div class="msg ' + (messages[i].role === 'user' ? 'u' : '') + '"><b>' + (messages[i].role === 'user' ? 'प्रश्न:' : 'ASTHL Analysis:') + '</b><br>' + esc + '</div>';
    }
    rh += '<div class="ft"><b>Disclaimer:</b> यह AI-assisted विश्लेषण है — निर्णय का आधार नहीं। Serious समस्या में डॉक्टर से मिलें।<br>संपर्क: +91-7903873282 | asthl.in</div>'
      + '<script>window.onload=function(){setTimeout(function(){window.print();},500);}<\/script></body></html>';
    var pr = window.open('', '_blank');
    if (!pr) { alert('पॉप-अप ब्लॉक हो गया — browser me pop-up allow करें फिर कोशिश करें।'); return; }
    pr.document.write(rh); pr.document.close(); pr.focus();
  });

  function getAccessId() { try { return localStorage.getItem('asthl_access_id') || ''; } catch (e) { return ''; } }

  // ===== v45: Doctor kamaai banner + Consultant medicine note =====
  async function showEarnBanner(accId) {
    if (!accId) return;
    var total = null;
    try {
      var d = await asPost({ action: 'getMyEarnings', consultantId: accId });
      if (d && d.status === 'ok') total = d.total;
    } catch (e) { return; }
    if (total === null) return;
    var old = document.getElementById('asthl-earn-banner');
    if (old) old.parentNode.removeChild(old);
    var b = document.createElement('div');
    b.id = 'asthl-earn-banner';
    b.style.cssText = 'background:linear-gradient(135deg,#0f766e,#0d9488);color:#fff;border-radius:12px;padding:10px 12px;margin:8px 10px 4px;font-size:13.5px;font-weight:600;line-height:1.5;box-shadow:0 3px 10px rgba(13,148,136,.3)';
    b.innerHTML = '💰 आपकी कुल कमाई (अब तक): <b style="font-size:16px">₹' + total + '</b><br><span style="font-size:11.5px;opacity:.9">ASTHL फीस कटौती के बाद • भुगतान अगले महीने के पहले हफ़्ते में</span>';
    if (msgContainer) msgContainer.insertBefore(b, msgContainer.firstChild);
  }

  function consultantNoteForm(a, accId, done) {
    var ov = openModal('');
    var box = ov.querySelector('#asthl-modal');
    box.innerHTML =
      '<h3 style="margin:0 0 8px;color:#0f766e">💊 दवा / सलाह लिखें — ' + asEsc(a.caseId) + '</h3>' +
      '<div style="font-size:12.5px;color:#64748b;margin-bottom:8px;line-height:1.5">मरीज़: ' + asEsc(a.patientName || '') + ' — यह भेजने वाले डॉक्टर को दिखेगा (वही मरीज़ को दवा देगा)।</div>' +
      '<textarea id="cn-note" rows="6" style="width:100%;font-family:inherit;font-size:14px;padding:11px;border:1.5px solid #ccfbf1;border-radius:12px;outline:none" placeholder="दवा का नाम, potency, कैसे लें, कितने दिन, सावधानी / आहार सलाह..."></textarea>' +
      '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">' +
      '<button id="cn-back" style="flex:1;min-width:100px;font-family:inherit;font-size:14px;font-weight:700;padding:12px;border-radius:12px;border:none;background:#f1f5f9;color:#475569;cursor:pointer">← वापस</button>' +
      '<button id="cn-save" style="flex:2;min-width:150px;font-family:inherit;font-size:14px;font-weight:700;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,#0d9488,#0f766e);color:#fff;cursor:pointer">💾 सुरक्षित करें</button>' +
      '</div>';
    box.querySelector('#cn-back').addEventListener('click', function () { ov.remove(); if (done) done(); });
    box.querySelector('#cn-save').addEventListener('click', async function () {
      var note = box.querySelector('#cn-note').value.trim();
      if (note.length < 3) { alert('दवा / सलाह लिखें।'); return; }
      var btn = box.querySelector('#cn-save'); btn.disabled = true; btn.textContent = 'सुरक्षित कर रहे हैं...';
      try {
        var d = await asPost({ action: 'saveConsultantNote', consultantId: accId, caseId: a.caseId, note: note });
        if (d && d.status === 'ok') {
          box.innerHTML = '<h3 style="margin:0 0 8px;color:#15803d">✅ सुरक्षित हो गया!</h3><p style="font-size:13.5px;color:#334155;line-height:1.6">यह सलाह केस <b>' + asEsc(a.caseId) + '</b> में जुड़ गई — भेजने वाले डॉक्टर को सूचना भेज दी गई है।</p>';
          setTimeout(function () { ov.remove(); if (done) done(); }, 1300);
        } else { alert('सेव नहीं हुआ — दोबारा कोशिश करें।'); btn.disabled = false; btn.textContent = '💾 सुरक्षित करें'; }
      } catch (e) { alert('कनेक्शन त्रुटि।'); btn.disabled = false; btn.textContent = '💾 सुरक्षित करें'; }
    });
  }

  function showNoteFlash(list, accId) {
    var n = list[0];
    var ov = openModal(
      '<h3 style="margin:0 0 8px;color:#0f766e">💊 परामर्श डॉक्टर ने दवा / सलाह लिखी</h3>' +
      '<div style="font-size:12.5px;color:#64748b;margin-bottom:6px">केस ' + asEsc(n.caseId) + ' • ' + asEsc(n.consultantName) + '</div>' +
      '<div style="background:#f0fdfa;border:1.5px solid #ccfbf1;border-radius:12px;padding:12px;font-size:13.5px;color:#134e4a;line-height:1.7;white-space:pre-wrap">' + asEsc(n.note) + '</div>' +
      '<button id="nf-ok" style="width:100%;margin-top:14px;font-family:inherit;font-size:14px;font-weight:700;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,#0d9488,#0f766e);color:#fff;cursor:pointer">ठीक है</button>'
    );
    ov.querySelector('#nf-ok').addEventListener('click', async function () {
      ov.remove();
      try { await asPost({ action: 'markNoteNotified', caseId: n.caseId, consultantId: n.consultantId }); } catch (e) {}
      checkAssignments(accId);
    });
  }

  // ===== v49: case list me assign status badge =====
  function asFlagText(a) {
    var st = String(a.status || '');
    var who = String(a.consultantName || '').replace(/^\s*Dr\.?\s*/i, '');
    if (st === 'Accepted') return { t: '✅ ' + who + ' को assign' + (a.when ? ' — ' + a.when : ''), c: 'ok' };
    if (st === 'Rejected') return { t: '❌ ' + who + ' ने मना किया', c: 'bad' };
    if (st === 'Sent to Consultant') return { t: '⏳ ' + who + ' — जवाब बाकी', c: 'pend' };
    if (st === 'Awaiting Confirmation') return { t: '⏳ ' + who + ' — भुगतान पुष्टि बाकी', c: 'pend' };
    return { t: '📤 ' + who, c: 'pend' };
  }

  // ===== v44: ASSIGNMENTS — consultant ko case flash + Accept/Reject =====
  function asEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function asToday() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function asDaysOld(v) { var t = new Date(v); if (isNaN(t)) return 0; return Math.floor((Date.now() - t.getTime()) / 86400000); }
  function asPost(body) {
    return fetch(ORDERS_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json(); });
  }

  async function checkAssignments(accId) {
    if (!accId) return;
    var mine = [], updates = [];
    try {
      var d1 = await asPost({ action: 'getMyAssignments', consultantId: accId });
      mine = (d1 && d1.assignments) || [];
      var d2 = await asPost({ action: 'getAssignUpdates', assigningDoctor: accId });
      updates = (d2 && d2.updates) || [];
    } catch (e) { return; }

    // 1) kehne wale doctor ko notification (accept/reject ho gaya)
    if (updates.length) { showAssignUpdateFlash(updates, accId); return; }

    // 1b) consultant ne dawa/salah likhi → kehne wale ko dikhao
    var notes = [];
    try {
      var d3 = await asPost({ action: 'getConsultantNotes', assigningDoctor: accId });
      notes = (d3 && d3.notes) || [];
    } catch (e) {}
    if (notes.length) { showNoteFlash(notes, accId); return; }

    // 2) naya case → Accept/Reject flash (har login par, jab tak action na ho)
    var pending = mine.filter(function (a) { return String(a.status || '').toLowerCase().indexOf('sent') !== -1; });
    if (pending.length) { showAssignFlash(pending, accId); return; }

    // 3) accept ho gaya → roz pehli login par reminder
    var accepted = mine.filter(function (a) { return String(a.status || '').toLowerCase().indexOf('accept') !== -1; });
    var todo = accepted.filter(function (a) {
      var v = null; try { v = localStorage.getItem('asthl_rem_' + a.caseId); } catch (e) {}
      return v !== asToday();
    });
    if (todo.length) { showAcceptedReminder(todo, accId); }
  }

  function showAssignFlash(list, accId) {
    var ov = openModal('');
    var box = ov.querySelector('#asthl-modal');
    var idx = 0;
    function renderCase() {
      var a = list[idx];
      var old = asDaysOld(a.date);
      box.innerHTML =
        '<h3 style="margin:0 0 6px;color:#134e4a">📤 नया केस मिला (' + (idx + 1) + '/' + list.length + ')</h3>' +
        '<div style="font-size:13.5px;color:#334155;line-height:1.75">' +
        '<b>केस ID:</b> ' + asEsc(a.caseId) + '<br>' +
        '<b>मरीज़:</b> ' + asEsc(a.patientName || '—') + '<br>' +
        '<b>भेजने वाले:</b> ' + asEsc(a.assigningDoctor || '—') + '<br>' +
        '<b>परामर्श फीस:</b> ₹' + asEsc(a.fee) + '<br>' +
        '<b>स्रोत:</b> ' + asEsc(a.source || 'Doctor Referral') + '<br>' +
        (a.summary ? '<b>मरीज़ की मुख्य बात:</b><br><span style="background:#f0fdfa;border:1px solid #ccfbf1;border-radius:10px;padding:8px;display:block;margin:4px 0">' + asEsc(a.summary) + '</span>' : '') +
        (old >= 3 ? '<span style="color:#b45309;font-weight:700">⏳ ' + old + ' दिन से प्रतीक्षा में</span>' : '') +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">' +
        '<button id="as-accept" style="flex:1;min-width:130px;font-family:inherit;font-size:14px;font-weight:700;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;cursor:pointer">✅ स्वीकार करें</button>' +
        '<button id="as-reject" style="flex:1;min-width:130px;font-family:inherit;font-size:14px;font-weight:700;padding:12px;border-radius:12px;border:none;background:#fef2f2;color:#b91c1c;border:1.5px solid #fecaca;cursor:pointer">❌ मना करें</button>' +
        '</div>' +
        '<button id="as-later" style="width:100%;margin-top:8px;font-family:inherit;font-size:13px;padding:10px;border-radius:12px;border:none;background:#f1f5f9;color:#475569;cursor:pointer">बाद में देखेंगे</button>';
      box.querySelector('#as-accept').addEventListener('click', function () { acceptForm(a, accId, function () { next(); }); });
      box.querySelector('#as-reject').addEventListener('click', function () { rejectForm(a, accId, function () { next(); }); });
      box.querySelector('#as-later').addEventListener('click', function () { ov.remove(); });
    }
    function next() { idx++; if (idx < list.length) renderCase(); else { ov.remove(); checkAssignments(accId); } }
    renderCase();
  }

  function acceptForm(a, accId, done) {
    var ov = openModal('');
    var box = ov.querySelector('#asthl-modal');
    box.innerHTML =
      '<h3 style="margin:0 0 8px;color:#15803d">✅ केस स्वीकार करें — ' + asEsc(a.caseId) + '</h3>' +
      '<label style="font-size:13px;font-weight:600">कितने दिन लगेंगे? *</label>' +
      '<input id="as-days" type="number" min="1" placeholder="जैसे: 3" style="width:100%;font-family:inherit;font-size:15px;padding:11px;border:1.5px solid #ccfbf1;border-radius:12px;outline:none;margin:6px 0 12px">' +
      '<label style="font-size:13px;font-weight:600">किस समय देखेंगे? *</label>' +
      '<input id="as-time" placeholder="जैसे: रोज़ शाम 6 बजे" style="width:100%;font-family:inherit;font-size:15px;padding:11px;border:1.5px solid #ccfbf1;border-radius:12px;outline:none;margin:6px 0 12px">' +
      '<label style="font-size:13px;font-weight:600">टिप्पणी (optional)</label>' +
      '<textarea id="as-comment" rows="2" style="width:100%;font-family:inherit;font-size:14px;padding:11px;border:1.5px solid #ccfbf1;border-radius:12px;outline:none;margin:6px 0 12px" placeholder="मरीज़ से क्या पूछना है / कोई बात"></textarea>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button id="as-cancel" style="flex:1;min-width:100px;font-family:inherit;font-size:14px;font-weight:700;padding:12px;border-radius:12px;border:none;background:#f1f5f9;color:#475569;cursor:pointer">← वापस</button>' +
      '<button id="as-ok" style="flex:2;min-width:150px;font-family:inherit;font-size:14px;font-weight:700;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;cursor:pointer">✅ स्वीकार करें</button>' +
      '</div>';
    box.querySelector('#as-cancel').addEventListener('click', function () { ov.remove(); });
    box.querySelector('#as-ok').addEventListener('click', async function () {
      var days = box.querySelector('#as-days').value.trim();
      var time = box.querySelector('#as-time').value.trim();
      var cm = box.querySelector('#as-comment').value.trim();
      if (!days || !time) { alert('दिन और समय दोनों भरें।'); return; }
      var btn = box.querySelector('#as-ok'); btn.disabled = true; btn.textContent = 'भेज रहे हैं...';
      try {
        var d = await asPost({ action: 'respondAssign', consultantId: accId, caseId: a.caseId, decision: 'Accepted', days: days, time: time, comment: cm });
        if (d && d.status === 'ok') {
          box.innerHTML = '<h3 style="margin:0 0 8px;color:#15803d">✅ केस स्वीकार हो गया!</h3><p style="font-size:13.5px;color:#334155;line-height:1.65">केस <b>' + asEsc(a.caseId) + '</b> — ' + asEsc(days) + ' दिन, ' + asEsc(time) + '।<br>भेजने वाले डॉक्टर को सूचना भेज दी गई है।</p>';
          setTimeout(function () { ov.remove(); if (done) done(); }, 1400);
        } else { alert('सेव नहीं हुआ — दोबारा कोशिश करें।'); btn.disabled = false; btn.textContent = '✅ स्वीकार करें'; }
      } catch (e) { alert('कनेक्शन त्रुटि।'); btn.disabled = false; btn.textContent = '✅ स्वीकार करें'; }
    });
  }

  function rejectForm(a, accId, done) {
    var ov = openModal('');
    var box = ov.querySelector('#asthl-modal');
    box.innerHTML =
      '<h3 style="margin:0 0 8px;color:#b91c1c">❌ केस मना करें — ' + asEsc(a.caseId) + '</h3>' +
      '<label style="font-size:13px;font-weight:600">कारण *</label>' +
      '<textarea id="as-reason" rows="2" style="width:100%;font-family:inherit;font-size:14px;padding:11px;border:1.5px solid #fecaca;border-radius:12px;outline:none;margin:6px 0 12px" placeholder="क्यों नहीं ले सकते"></textarea>' +
      '<label style="font-size:13px;font-weight:600">किसे भेजें? (सुझाव — नाम/ID, optional)</label>' +
      '<input id="as-suggest" placeholder="जैसे: Dr. Meena Sharma (ASTHL9001)" style="width:100%;font-family:inherit;font-size:15px;padding:11px;border:1.5px solid #ccfbf1;border-radius:12px;outline:none;margin:6px 0 12px">' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button id="as-cancel2" style="flex:1;min-width:100px;font-family:inherit;font-size:14px;font-weight:700;padding:12px;border-radius:12px;border:none;background:#f1f5f9;color:#475569;cursor:pointer">← वापस</button>' +
      '<button id="as-ok2" style="flex:2;min-width:150px;font-family:inherit;font-size:14px;font-weight:700;padding:12px;border-radius:12px;border:none;background:#dc2626;color:#fff;cursor:pointer">❌ मना करें</button>' +
      '</div>';
    box.querySelector('#as-cancel2').addEventListener('click', function () { ov.remove(); });
    box.querySelector('#as-ok2').addEventListener('click', async function () {
      var reason = box.querySelector('#as-reason').value.trim();
      var sug = box.querySelector('#as-suggest').value.trim();
      if (reason.length < 3) { alert('कारण लिखें।'); return; }
      var btn = box.querySelector('#as-ok2'); btn.disabled = true; btn.textContent = 'भेज रहे हैं...';
      try {
        var d = await asPost({ action: 'respondAssign', consultantId: accId, caseId: a.caseId, decision: 'Rejected', rejectReason: reason, suggestTo: sug, comment: '' });
        if (d && d.status === 'ok') {
          box.innerHTML = '<h3 style="margin:0 0 8px;color:#b91c1c">केस मना किया गया</h3><p style="font-size:13.5px;color:#334155;line-height:1.65">ASTHL को सूचना मिल गई — वे आगे की व्यवस्था करेंगे।</p>';
          setTimeout(function () { ov.remove(); if (done) done(); }, 1400);
        } else { alert('सेव नहीं हुआ।'); btn.disabled = false; btn.textContent = '❌ मना करें'; }
      } catch (e) { alert('कनेक्शन त्रुटि।'); btn.disabled = false; btn.textContent = '❌ मना करें'; }
    });
  }

  function showAssignUpdateFlash(list, accId) {
    var a = list[0];
    var acc = String(a.status || '').toLowerCase().indexOf('accept') !== -1;
    var ov = openModal(
      '<h3 style="margin:0 0 8px;color:' + (acc ? '#15803d' : '#b91c1c') + '">' + (acc ? '✅ केस स्वीकार हुआ!' : '❌ केस मना किया गया') + '</h3>' +
      '<div style="font-size:13.5px;color:#334155;line-height:1.75">' +
      '<b>केस:</b> ' + asEsc(a.caseId) + '<br>' +
      '<b>डॉक्टर:</b> ' + asEsc(a.consultantName) + ' (' + asEsc(a.consultantId) + ')<br>' +
      (acc ? ('<b>समय:</b> ' + asEsc(a.when || '')) : ('<b>कारण:</b> ' + asEsc(a.rejectReason))) +
      '</div>' +
      '<button id="as-ok3" style="width:100%;margin-top:14px;font-family:inherit;font-size:14px;font-weight:700;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,#0d9488,#0f766e);color:#fff;cursor:pointer">ठीक है</button>'
    );
    ov.querySelector('#as-ok3').addEventListener('click', async function () {
      ov.remove();
      try { await asPost({ action: 'markNotified', caseId: a.caseId, consultantId: a.consultantId }); } catch (e) {}
      checkAssignments(accId);
    });
  }

  function showAcceptedReminder(list, accId) {
    var html = '<h3 style="margin:0 0 8px;color:#0f766e">🔔 आज का रिमाइंडर</h3><div style="font-size:13.5px;color:#334155;line-height:1.8">';
    list.forEach(function (a, i) {
      html += 'केस <b>' + asEsc(a.caseId) + '</b> — ' + asEsc(a.patientName || '') + '<br>' + asEsc(a.when || a.days || '') + '<br>' +
        '<button class="cn-open" data-i="' + i + '" style="margin:6px 0 12px;font-family:inherit;font-size:12.5px;font-weight:700;padding:8px 12px;border-radius:10px;border:none;background:#0d9488;color:#fff;cursor:pointer">💊 दवा / सलाह लिखें</button><br>';
      try { localStorage.setItem('asthl_rem_' + a.caseId, asToday()); } catch (e) {}
    });
    html += '</div><p style="font-size:12.5px;color:#64748b">इलाज पूरा होने पर ASTHL को बताएँ — तब भुगतान अगले महीने के पहले हफ़्ते में मिलेगा।</p>' +
      '<button id="as-ok4" style="width:100%;margin-top:12px;font-family:inherit;font-size:14px;font-weight:700;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,#0d9488,#0f766e);color:#fff;cursor:pointer">समझ गया</button>';
    var ov = openModal(html);
    ov.querySelector('#as-ok4').addEventListener('click', function () { ov.remove(); });
    var cns = ov.querySelectorAll('.cn-open');
    for (var ci = 0; ci < cns.length; ci++) {
      cns[ci].addEventListener('click', (function (b) {
        return function () { consultantNoteForm(list[parseInt(b.getAttribute('data-i'), 10)], accId, function () { showAcceptedReminder(list, accId); }); };
      })(cns[ci]));
    }
  }

  // ===== v43: ASSIGN & PAY — apna case experienced doctor ko bhejein =====
  function asUpiLink(amount, note) {
    return 'upi://pay?pa=' + encodeURIComponent('asthl@ybl') + '&pn=' + encodeURIComponent('ASTHL') + '&am=' + encodeURIComponent(amount) + '&cu=INR&tn=' + encodeURIComponent(note || 'ASTHL Consultant Fee');
  }
  async function openAssignPanel(caseId, caseName, accId) {
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var ov = openModal('<h3 style="margin:0 0 8px;color:#134e4a">📤 डॉक्टर सूची लोड हो रही है...</h3><p style="font-size:13px;color:#64748b">कृपया रुकें</p>');
    var box = ov.querySelector('#asthl-modal');
    var docs = [];
    var data = null, netErr = false;
    try {
      var res = await fetch(ORDERS_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'listConsultants', selfId: accId }) });
      data = await res.json();
      if (!res.ok || (data && data.error && !data.consultants)) netErr = true;
      docs = (data && data.consultants) || [];
    } catch (e) {
      netErr = true;
    }
    if (netErr) {
      box.innerHTML = '<h3 style="margin:0 0 8px;color:#b91c1c">⚠️ डॉक्टर सूची नहीं आ सकी</h3>' +
        '<p style="font-size:13px;color:#334155;line-height:1.7">शीट से जवाब नहीं आया।<br>' + asEsc((data && data.error) || 'कनेक्शन त्रुटि') + '<br><br>' +
        '<b>ASTHL से संपर्क करें:</b> कॉल/व्हाट्सप्प +91-7903873282</p>';
      return;
    }
    if (!docs.length) {
      if (data && data.selfOnly) {
        box.innerHTML = '<h3 style="margin:0 0 8px;color:#134e4a">📤 Assign &amp; Pay</h3>' +
          '<p style="font-size:13.5px;color:#64748b;line-height:1.7">अभी सूची में केवल <b>आपकी ही ID (' + asEsc(data.selfId || accId) + ')</b> है — और खुद को केस assign नहीं किया जा सकता।<br><br>किसी <b>दूसरे डॉक्टर</b> को केस भेजने के लिए उनकी ID से login करें (या उनकी ID से इस केस को assign कराएँ)।</p>';
        return;
      }
      box.innerHTML = '<h3 style="margin:0 0 8px;color:#134e4a">📤 Assign &amp; Pay</h3><p style="font-size:13.5px;color:#64748b;line-height:1.6">अभी कोई परामर्श-योग्य डॉक्टर उपलब्ध नहीं है।<br><br>डॉक्टर तभी सूची में आते हैं जब उनकी <b>Login ID बन चुकी हो</b>, <b>अनुभव/फीस/विशेषज्ञता</b> भरी हो और <b>उपलब्ध = हाँ</b> हो।<br><br>जाँच के लिए ASTHL: +91-7903873282</p>';
      return;
    }
    docs.sort(function (a, b) { return (parseFloat(b.exp) || 0) - (parseFloat(a.exp) || 0); });
    var existing = null;
    try {
      var sd = await asPost({ action: 'getAssignSummary', caseId: caseId });
      existing = ((sd && sd.rows) || [])[0] || null;
    } catch (e) {}
    var existBox = '';
    if (existing) {
      var fl = asFlagText(existing);
      existBox = '<div style="background:' + (fl.c === 'ok' ? '#f0fdf4' : (fl.c === 'bad' ? '#fef2f2' : '#fffbeb')) + ';border:1.5px solid ' + (fl.c === 'ok' ? '#bbf7d0' : (fl.c === 'bad' ? '#fecaca' : '#fde68a')) + ';border-radius:12px;padding:10px;margin-bottom:10px;font-size:12.5px;line-height:1.6;color:#334155">' +
        '<b>ℹ️ यह केस पहले ही भेजा जा चुका है</b><br>' + fl.t + (existing.paymentStatus ? ' • भुगतान: ' + asEsc(existing.paymentStatus) : '') +
        '<br><span style="font-size:11.5px;color:#64748b">नीचे से दोबारा किसी और डॉक्टर को भी भेज सकते हैं।</span></div>';
    }
    var headHtml =
      '<h3 style="margin:0 0 4px;color:#134e4a">📤 Assign &amp; Pay</h3>' +
      existBox +
      '<div style="font-size:12.5px;color:#64748b;margin-bottom:10px;line-height:1.5">केस: <b>' + esc(caseName) + '</b><br>ID: ' + esc(caseId) + ' • सबसे ऊपर सबसे अनुभवी डॉक्टर</div>' +
      '<input id="as-search" placeholder="🔍 नाम / ID / विशेषज्ञता से खोजें" style="width:100%;font-family:inherit;font-size:14px;padding:11px 12px;border:1.5px solid #ccfbf1;border-radius:12px;outline:none;margin-bottom:10px">' +
      '<div id="as-list" style="max-height:44vh;overflow-y:auto"></div>';
    var curList = docs;
    var listEl = null;

    function renderList(q) {
      curList = docs;
      if (q) { var qq = String(q).toLowerCase(); curList = docs.filter(function (d) { return (d.name + ' ' + d.id + ' ' + d.expertise + ' ' + d.city).toLowerCase().indexOf(qq) !== -1; }); }
      var h = '';
      if (!curList.length) h = '<p style="font-size:13px;color:#64748b;padding:10px">कोई डॉक्टर नहीं मिला।</p>';
      for (var i = 0; i < curList.length; i++) {
        var d = curList[i];
        h += '<div class="as-doc" data-i="' + i + '" style="border:1.5px solid #ccfbf1;border-radius:14px;padding:12px;margin-bottom:8px;cursor:pointer">' +
             '<b style="color:#0f766e;font-size:14.5px">' + esc(d.name) + '</b> <span style="font-size:11.5px;color:#64748b">ID: ' + esc(d.id) + '</span>' +
             '<div style="font-size:12.5px;color:#334155;margin-top:4px">🎓 ' + esc(d.qual) + ' • ⏳ ' + esc(d.exp) + ' वर्ष अनुभव</div>' +
             '<div style="font-size:12.5px;color:#334155">🩺 ' + esc(d.expertise) + '</div>' +
             '<div style="font-size:13.5px;font-weight:700;color:#b45309;margin-top:4px">₹' + esc(d.fee) + ' / केस</div>' +
             '</div>';
      }
      listEl.innerHTML = h;
      var items = listEl.querySelectorAll('.as-doc');
      for (var k = 0; k < items.length; k++) {
        items[k].addEventListener('click', (function (idx) { return function () { showDoc(curList[idx]); }; })(k));
      }
    }
    function showList() {
      box.innerHTML = headHtml;
      listEl = box.querySelector('#as-list');
      var inp = box.querySelector('#as-search');
      inp.addEventListener('input', function () { renderList(inp.value); });
      renderList('');
    }
    function showDoc(d) {
      box.innerHTML =
        '<h3 style="margin:0 0 8px;color:#134e4a">👨‍⚕️ ' + esc(d.name) + '</h3>' +
        '<div style="font-size:13.5px;color:#334155;line-height:1.8">' +
        '<b>ID:</b> ' + esc(d.id) + '<br>' +
        '<b>योग्यता:</b> ' + esc(d.qual) + '<br>' +
        '<b>अनुभव:</b> ' + esc(d.exp) + ' वर्ष<br>' +
        '<b>विशेषज्ञता:</b> ' + esc(d.expertise) + '<br>' +
        (d.clinic ? '<b>क्लिनिक:</b> ' + esc(d.clinic) + '<br>' : '') +
        (d.city ? '<b>शहर:</b> ' + esc(d.city) + '<br>' : '') +
        (d.about ? '<b>परिचय:</b> ' + esc(d.about) + '<br>' : '') +
        '<b>परामर्श फीस:</b> <span style="color:#b45309;font-weight:800">₹' + esc(d.fee) + ' / केस</span>' +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">' +
        '<button id="as-back" style="flex:1;min-width:110px;font-family:inherit;font-size:14px;font-weight:700;padding:12px;border-radius:12px;border:none;background:#f1f5f9;color:#475569;cursor:pointer">← वापस</button>' +
        '<button id="as-confirm" style="flex:2;min-width:170px;font-family:inherit;font-size:14px;font-weight:700;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,#0d9488,#0f766e);color:#fff;cursor:pointer">✅ चुनें व भुगतान करें — ₹' + esc(d.fee) + '</button>' +
        '</div>';
      box.querySelector('#as-back').addEventListener('click', showList);
      box.querySelector('#as-confirm').addEventListener('click', function () { payStep(d); });
    }
    function payStep(d) {
      var uri = asUpiLink(d.fee, 'ASTHL Consultant Fee ' + caseId);
      var qr = 'https://api.qrserver.com/v1/create-qr-code/?size=210x210&margin=8&data=' + encodeURIComponent(uri);
      box.innerHTML =
        '<h3 style="margin:0 0 6px;color:#134e4a">💰 परामर्श फीस — ₹' + esc(d.fee) + '</h3>' +
        '<div style="font-size:12.5px;color:#64748b;margin-bottom:10px;line-height:1.5">' + esc(d.name) + ' (' + esc(d.id) + ') • केस ' + esc(caseId) + '</div>' +
        '<div style="text-align:center"><img src="' + qr + '" alt="UPI QR" onerror="this.style.display=\'none\';var w=document.getElementById(\'as-qrwarn\');if(w)w.style.display=\'block\';" style="width:190px;height:190px;border:1px solid #ccfbf1;border-radius:12px"><div id="as-qrwarn" style="display:none;font-size:12.5px;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:8px;margin-top:6px">QR load nahi hua — niche wale UPI button se bhugtan karein.</div><div style="font-weight:700;color:#0f766e;margin-top:6px">asthl@ybl</div></div>' +
        '<a href="' + uri + '" style="display:block;text-align:center;margin-top:10px;background:linear-gradient(135deg,#0d9488,#0f766e);color:#fff;font-weight:700;padding:12px;border-radius:12px;text-decoration:none">📱 ₹' + esc(d.fee) + ' भुगतान करें (UPI)</a>' +
        '<input id="as-utr" placeholder="UTR / भुगतान संदर्भ नंबर" style="width:100%;font-family:inherit;font-size:14px;padding:11px 12px;border:1.5px solid #ccfbf1;border-radius:12px;outline:none;margin-top:12px">' +
        '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">' +
        '<button id="as-back2" style="flex:1;min-width:110px;font-family:inherit;font-size:14px;font-weight:700;padding:12px;border-radius:12px;border:none;background:#f1f5f9;color:#475569;cursor:pointer">← वापस</button>' +
        '<button id="as-submit" style="flex:2;min-width:150px;font-family:inherit;font-size:14px;font-weight:700;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;cursor:pointer">📩 भुगतान के बाद सबमिट करें</button>' +
        '</div>' +
        '<p style="font-size:11.5px;color:#64748b;margin-top:10px;line-height:1.5">भुगतान ASTHL (asthl@ybl) को होता है। ASTHL पुष्टि करने के बाद ही केस डॉक्टर को भेजा जाएगा — पुष्टि से पहले नहीं।</p>';
      box.querySelector('#as-back2').addEventListener('click', function () { showDoc(d); });
      box.querySelector('#as-submit').addEventListener('click', function () { submitAssign(d, box.querySelector('#as-utr').value.trim()); });
    }
    async function submitAssign(d, utr) {
      var btn = box.querySelector('#as-submit');
      btn.disabled = true; btn.textContent = 'भेज रहे हैं...';
      try {
        var r = await fetch(ORDERS_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          action: 'saveAssignPay', caseId: caseId, patientName: caseName, assigningDoctor: accId,
          consultantId: d.id, consultantName: d.name, fee: String(d.fee), utr: utr
        }) });
        var dd = await r.json();
        if (dd && dd.status === 'ok') {
          box.innerHTML = '<h3 style="margin:0 0 8px;color:#15803d">✅ अनुरोध भेज दिया गया!</h3><p style="font-size:13.5px;color:#334155;line-height:1.65">केस <b>' + esc(caseId) + '</b> — ' + esc(d.name) + ' को भेजने का अनुरोध ASTHL को मिल गया।<br><br><b>ASTHL भुगतान की पुष्टि करते ही</b> यह केस डॉक्टर को भेज दिया जाएगा — आपको सूचना मिलती रहेगी।</p>';
        } else {
          alert('सेव नहीं हुआ — दोबारा कोशिश करें।' + (dd && dd.error ? '\n' + dd.error : ''));
          btn.disabled = false; btn.textContent = '📩 भुगतान के बाद सबमिट करें';
        }
      } catch (e) {
        alert('कनेक्शन त्रुटि — दोबारा कोशिश करें।');
        btn.disabled = false; btn.textContent = '📩 भुगतान के बाद सबमिट करें';
      }
    }
    showList();
  }

  function openModal(html) {
    var ov = document.createElement('div');
    ov.id = 'asthl-modal-overlay';
    ov.innerHTML = '<div id="asthl-modal">' + html + '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
    return ov;
  }

  saveCaseBtn.addEventListener('click', async function() {
    var accId = getAccessId();
    if (!accId) { alert('\u092A\u0939\u0932\u0947 ID se login \u0915\u0930\u0947\u0902\u0964'); return; }
    if (messages.length < 3) { alert('\u092A\u0939\u0932\u0947 \u0915\u094B\u0908 \u091A\u0948\u091F/\u0915\u0947\u0938 \u0915\u0930\u0947\u0902 \u2014 \u092B\u093E\u0930\u094D\u092E \u0916\u093E\u0932\u0940 \u0939\u0948\u0964'); return; }
    var ov = openModal(
      '<h3 style="margin:0 0 6px;color:#134e4a">💾 ' + (loadedCaseId ? '\u0915\u0947\u0938 \u0905\u092A\u0921\u0947\u091F \u0915\u0930\u0947\u0902 — ' + loadedCaseId : '\u0915\u0947\u0938 \u0938\u0947\u0935 \u0915\u0930\u0947\u0902') + '</h3>'
      + '<div class="asthl-form-group"><label>\u092E\u0930\u0940\u095B \u0915\u093E \u0928\u093E\u092E *</label><input id="asthl-case-name" type="text" placeholder="\u0928\u093E\u092E \u0932\u093F\u0916\u0947\u0902" /></div>'
      + '<div class="asthl-form-group"><label>मरीड़ का मोबाइल (दवा बिल के लिए)</label><input id="asthl-case-mobile" type="tel" inputmode="numeric" placeholder="10 अंकों का नंबर" /></div>'
      + '<div class="asthl-form-group"><label>\u0938\u092E\u0938\u094D\u092F\u093E / Issue *</label><input id="asthl-case-issue" type="text" placeholder="\u091C\u0948\u0938\u0947: \u0917\u0948\u0938, \u092E\u0932 \u0924\u094D\u092F\u093E\u0917 \u0915\u0940 \u0938\u092E\u0938\u094D\u092F\u093E" /></div>'
      + '<button id="asthl-case-save-go" class="asthl-btn-primary">\u0938\u0947\u0935 \u0915\u0930\u0947\u0902 \u2192</button>'
      + '<p style="font-size:11.5px;color:#64748b;margin:10px 0 0;text-align:center">\u092A\u0942\u0930\u0940 \u091A\u0948\u091F + \u0926\u0935\u093E \u0911\u091F\u094B\u092E\u0947\u091F\u093F\u0915 \u0938\u0947\u0935 \u0939\u094B \u091C\u093E\u090F\u0917\u0940</p>'
    );
    ov.querySelector('#asthl-case-save-go').addEventListener('click', async function() {
      var name = ov.querySelector('#asthl-case-name').value.trim();
      var issue = ov.querySelector('#asthl-case-issue').value.trim();
      var mob = ov.querySelector('#asthl-case-mobile').value.replace(/\D/g, '');
      if (!name || !issue) { alert('\u0928\u093E\u092E \u0914\u0930 \u0938\u092E\u0938\u094D\u092F\u093E \u0926\u094B\u0928\u094B\u0902 \u0921\u093E\u0932\u0947\u0902\u0964'); return; }
      if (mob && mob.length !== 10) { alert('मोबाइल नंबर पूरा नहीं है — 10 अंक लिखें या खाली छोड़ दें।'); return; }
      var btn = ov.querySelector('#asthl-case-save-go');
      btn.disabled = true; btn.textContent = '\u0938\u0947\u0935 \u0939\u094B \u0930\u0939\u093E \u0939\u0948...';
      try {
        var conv = messages.slice(1);
        var res = await fetch(CASES_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', caseId: loadedCaseId || '', accessId: accId, name: name, issue: issue, mobile: mob, conversation: JSON.stringify(conv) }) });
        var data = await res.json();
        if (data.status === 'ok' && data.caseId) {
          loadedCaseId = data.caseId;
          ov.remove();
          alert('\u2705 ' + (data.updated ? '\u0915\u0947\u0938 \u0905\u092A\u0921\u0947\u091F \u0939\u094B \u0917\u092F\u093E (\u0935\u0939\u0940\u0902 \u092A\u0941\u0930\u093E\u0928\u0940 ID): ' : '\u0915\u0947\u0938 \u0938\u0947\u0935 \u0939\u094B \u0917\u092F\u093E: ') + data.caseId + '\n(\u0928\u093E\u092E: ' + name + ' | ' + issue + ')\n(Login ID: ' + accId + ' \u0938\u0947 \u0938\u0947\u0935 \u0939\u0941\u0926\u093E \u2014 \u0907\u0938\u0940 ID se login karke hi \u092F\u0939 case \u0926\u093F\u0916\u0947\u0917\u093E)\n\n\u092F\u0939 \u0915\u0947\u0938 \u0905\u092C 📂 Cases \u092E\u0947\u0902 \u092E\u093F\u0932\u0947\u0917\u093E \u2014 \u092C\u093E\u0926 \u092E\u0947\u0902 \u0916\u094B\u0932\u0915\u0930 follow-up \u0915\u0930 \u0938\u0915\u0924\u0947 \u0939\u0948\u0902\u0964');
        } else if (data.status === 'ok') {
          alert('⚠️ Google Sheet ka Apps Script PURANA version hai!\n\nscript.google.com par jaiye > apna ASTHL project > poori file replace karein naye google-sheet-script.js (v9) se > Deploy > Manage deployments > Edit (pencil) > Version: New version > Deploy.\n\nUske baad wapas yahan Save karein.');
        } else { alert('त्रुटि: ' + (data.error || 'save fail')); }
      } catch (err) { alert('\u0915\u0928\u0947\u0915\u094D\u0936\u0928 \u0924\u094D\u0930\u0941\u091F\u093F\u0964 \u0926\u094B\u092C\u093E\u0930\u093E \u0915\u094B\u0936\u093F\u0936 \u0915\u0930\u0947\u0902\u0964'); }
    });
  });

  casesBtn.addEventListener('click', async function() {
    var accId = getAccessId();
    if (!accId) { alert('\u092A\u0939\u0932\u0947 ID se login \u0915\u0930\u0947\u0902\u0964'); return; }
    var ov = openModal('<h3 style="margin:0 0 10px;color:#134e4a">📂 \u0932\u094B\u0921 \u0939\u094B \u0930\u0939\u093E \u0939\u0948...</h3>');
    try {
      var res = await fetch(CASES_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'list', accessId: accId }) });
      var data = await res.json();
      if (data.status === 'ok' && !Array.isArray(data.cases)) {
        ov.querySelector('#asthl-modal').innerHTML = '<h3 style="margin:0 0 10px;color:#b91c1c">⚠️ Google Sheet Script Purana Hai</h3><p style="font-size:13px;color:#334155;line-height:1.6">Cases isliye nahi dikh rahe kyunki Apps Script ka <b>naya version deploy nahi hua</b> hai — save bhi asal mein Sheet mein nahi gaya hai.<br><br><b>Karein:</b> script.google.com > apna project > poori file replace karein naye <b>google-sheet-script.js (v9)</b> se > <b>Deploy > Manage deployments > Edit > New version > Deploy</b>.<br><br>Phir wapas aakar 📂 Cases dabayein.</p>';
        return;
      }
      var cases = data.cases || [];
      if (!cases.length) { ov.querySelector('#asthl-modal').innerHTML = '<h3 style=\"margin:0 0 10px;color:#134e4a\">📂 \u0907\u0938 ID (' + accId + ') \u0938\u0947 \u0915\u094B\u0908 \u0915\u0947\u0938 \u0938\u0947\u0935 \u0928\u0939\u0940\u0902 \u0939\u0948</h3><p style=\"font-size:13px;color:#64748b;line-height:1.6\">\u091C\u093F\u0938 Login ID \u0938\u0947 \u0915\u0947\u0938 \u0938\u0947\u0935 \u0915\u093F\u092F\u093E \u0925\u093E, \u0935\u0939\u0940\u0902 ID \u0938\u0947 login \u0915\u0930\u0928\u0947 \u092A\u0930 \u0926\u093F\u0916\u0947\u0917\u093E\u0964<br>\u0928\u092F\u093E \u0915\u0947\u0938 \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u091A\u0948\u091F \u0915\u0930\u0915\u0947 💾 \u0938\u0947\u0935 \u0915\u0930\u0947\u0902\u0964</p>'; return; }
      cases.sort(function(a, b) { return (a.caseStatus === 'Closed' ? 1 : 0) - (b.caseStatus === 'Closed' ? 1 : 0); });
      // v47: consultant ki salah (alag storage — AI chat me kabhi nahi jati)
      var noteMap = {};
      try {
        var nd = await asPost({ action: 'getConsultantNotes', assigningDoctor: accId, all: true });
        ((nd && nd.notes) || []).forEach(function (n) { noteMap[n.caseId] = n; });
      } catch (e) {}
      // v49: assign status (pending / ho gaya)
      var assignMap = {};
      try {
        var ad = await asPost({ action: 'getAssignSummary', assigningDoctor: accId });
        ((ad && ad.rows) || []).forEach(function (x) { if (!assignMap[x.caseId]) assignMap[x.caseId] = x; });
      } catch (e) {}
      var html = '<h3 style=\"margin:0 0 10px;color:#134e4a\">📂 \u0938\u0947\u0935 \u0915\u093F\u090F \u0939\u0941\u090F \u0915\u0947\u0938 \u2014 ID: ' + accId + '</h3>';
      for (var i = 0; i < cases.length; i++) {
        var c = cases[i];
var isClosed = (c.caseStatus === 'Closed');
        html += '<div class="asthl-case-row' + (isClosed ? ' closed' : '') + '" data-cid="' + c.caseId + '"><b>' + c.name + '</b> <span class="asthl-case-pub">' + (c.isPublic ? '🌐 Public' : '') + (isClosed ? ' ✅ बंद' : '') + '</span><span class="asthl-case-meta">' + c.issue + '</span><span class="asthl-case-id">' + c.caseId + '</span>' + (isClosed ? '<button class="asthl-case-tg" data-tg="open">🔄 खोलें</button>' : '<button class="asthl-case-tg" data-tg="close">✅ बंद करें</button>') + (c.isPublic ? '<button class="asthl-case-pb" data-pb="private">🔒 Private</button>' : '<button class="asthl-case-pb" data-pb="public">🌐 Public</button>') + '<button class="asthl-case-as">📤 Assign &amp; Pay</button>' + (noteMap[c.caseId] ? '<button class="asthl-case-note" data-cid="' + c.caseId + '">📋 परामर्श सलाह</button>' : '') + (assignMap[c.caseId] ? (function (fl) { return '<span class="asthl-case-flag ' + fl.c + '">' + fl.t + '</span>'; })(asFlagText(assignMap[c.caseId])) : '') + '</div>';
      }
      ov.querySelector('#asthl-modal').innerHTML = html;
      var rows = ov.querySelectorAll('.asthl-case-row');
      for (var r = 0; r < rows.length; r++) {
        rows[r].addEventListener('click', (function(row) {
          return function() { var cid = row.getAttribute('data-cid'); ov.remove(); loadCaseById(cid, accId); };
        })(rows[r]));
      }
      var tgBtns = ov.querySelectorAll('.asthl-case-tg');
      for (var t = 0; t < tgBtns.length; t++) {
        tgBtns[t].addEventListener('click', (function(btn, row) {
          return function(ev) {
            ev.stopPropagation();
            var cid = row.getAttribute('data-cid');
            var wantClose = btn.getAttribute('data-tg') === 'close';
            if (!confirm(wantClose ? 'क्या इस केस को बंद करना है?\n\nबंद करने के बाद भी केस देखा जा सकता है — बस ✅ बंद निशान लग जाएगा और यह सूची में नीचे चला जाएगा।' : 'क्या इस बंद केस को दोबारा खोलना है?')) return;
            toggleCaseStatus(cid, wantClose ? 'close' : 'reopen', accId, ov);
          };
        })(tgBtns[t], tgBtns[t].closest('.asthl-case-row')));
      }
      var nbBtns = ov.querySelectorAll('.asthl-case-note');
      for (var nb = 0; nb < nbBtns.length; nb++) {
        nbBtns[nb].addEventListener('click', (function(btn) {
          return function(ev) {
            ev.stopPropagation();
            var cid = btn.getAttribute('data-cid');
            var n = noteMap[cid] || {};
            openModal('<h3 style="margin:0 0 6px;color:#92400e">📋 परामर्श डॉक्टर की सलाह</h3>' +
              '<div style="font-size:12px;color:#64748b;margin-bottom:8px;line-height:1.5">' + asEsc(n.consultantName || '') + ' • केस ' + asEsc(cid) + '</div>' +
              '<div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:12px;padding:12px;font-size:13.5px;color:#78350f;line-height:1.7;white-space:pre-wrap">' + asEsc(n.note || '') + '</div>' +
              '<p style="font-size:11.5px;color:#64748b;margin-top:10px;line-height:1.5">यह सलाह एक मानव परामर्श डॉक्टर की है — AI के 13-Point विश्लेषण से अलग रखी जाती है, इसलिए AI का analysis प्रभावित नहीं होता।</p>');
          };
        })(nbBtns[nb]));
      }
      var asBtns = ov.querySelectorAll('.asthl-case-as');
      for (var ab = 0; ab < asBtns.length; ab++) {
        asBtns[ab].addEventListener('click', (function(btn, row) {
          return function(ev) {
            ev.stopPropagation();
            var cid = row.getAttribute('data-cid');
            var cname = row.querySelector('b') ? row.querySelector('b').textContent : '';
            openAssignPanel(cid, cname, accId);
          };
        })(asBtns[ab], asBtns[ab].closest('.asthl-case-row')));
      }
      var pbBtns = ov.querySelectorAll('.asthl-case-pb');
      for (var p = 0; p < pbBtns.length; p++) {
        pbBtns[p].addEventListener('click', (function(btn, row) {
          return function(ev) {
            ev.stopPropagation();
            var cid = row.getAttribute('data-cid');
            var wantPublic = btn.getAttribute('data-pb') === 'public';
            if (!confirm(wantPublic ? 'Public karne par yeh case HAR login ID wala dekh sakega.\n\nPublic karein?' : 'Private karne par yeh case sirf AAPKI login ID se dikhega.\n\nPrivate karein?')) return;
            toggleCasePublic(cid, wantPublic ? 'public' : 'private', accId, ov);
          };
        })(pbBtns[p], pbBtns[p].closest('.asthl-case-row')));
      }
    } catch (err) {
      ov.querySelector('#asthl-modal').innerHTML = '<p style="font-size:13px;color:#b91c1c">\u0915\u0928\u0947\u0915\u094D\u0936\u0928 \u0924\u094D\u0930\u0941\u091F\u093F\u0964 \u0926\u094B\u092C\u093E\u0930\u093E \u0915\u094B\u0936\u093F\u0936 \u0915\u0930\u0947\u0902\u0964</p>';
    }
  });

  async function toggleCaseStatus(cid, act, accId, ov) {
    try {
      var res = await fetch(CASES_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: act, accessId: accId, caseId: cid }) });
      var data = await res.json();
      if (data.status === 'ok') { ov.remove(); casesBtn.click(); }
      else { alert('त्रुटि: ' + (data.error || 'फिर कोशिश करें')); }
    } catch (err) { alert('कनेक्शन त्रुटि। दोबारा कोशिश करें।'); }
  }

  async function toggleCasePublic(cid, act, accId, ov) {
    try {
      var res = await fetch(CASES_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: act, accessId: accId, caseId: cid }) });
      var data = await res.json();
      if (data.status === 'ok') { ov.remove(); casesBtn.click(); }
      else { alert('त्रुटि: ' + (data.error || 'फिर कोशिश करें')); }
    } catch (err) { alert('कनेक्शन त्रुटि। दोबारा कोशिश करें।'); }
  }

  // ===== v36: AUTO-SAVE (opened case ke liye) =====
  var autoSaveTimer = null;
  window._asthlAutoSave = false;
  function queueAutoSave() {
    if (!window._asthlAutoSave || !loadedCaseId) return;
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(doAutoSave, 5000);
  }
  function doAutoSave() {
    if (!window._asthlAutoSave || !loadedCaseId) return;
    var acc = getAccessId();
    if (!acc || !window._loadedCaseMeta) return;
    fetch(CASES_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', caseId: loadedCaseId, accessId: acc, name: window._loadedCaseMeta.name, issue: window._loadedCaseMeta.issue, mobile: window._loadedCaseMeta.mobile || '', conversation: JSON.stringify(messages.slice(1)) }) }).catch(function () {});
  }
  function showCaseStrip(cid) {
    var inputArea = document.getElementById('asthl-chat-input-area');
    if (!inputArea) return;
    var strip = document.getElementById('asthl-case-strip');
    if (!strip) {
      strip = document.createElement('div');
      strip.id = 'asthl-case-strip';
      strip.style.cssText = 'display:flex;align-items:center;gap:8px;background:#e0f2fe;border-top:1px solid #bae6fd;padding:5px 10px;font-size:11.5px;color:#075985;font-family:inherit;';
      inputArea.parentNode.insertBefore(strip, inputArea);
    }
    window._asthlAutoSave = true;
    strip.innerHTML = '📂 केस: <b>' + cid + '</b> • ⚡ अपटो-सेव: <b id="asthl-as-state">ऑन</b>';
    var tg = document.createElement('button');
    tg.textContent = 'बंद करें';
    tg.style.cssText = 'margin-left:auto;border:1px solid #38bdf8;background:#fff;color:#075985;border-radius:8px;padding:3px 10px;font-size:11px;cursor:pointer;font-family:inherit;';
    tg.onclick = function () {
      window._asthlAutoSave = !window._asthlAutoSave;
      var st = document.getElementById('asthl-as-state');
      if (st) st.textContent = window._asthlAutoSave ? 'ऑन' : 'ऑफ';
      tg.textContent = window._asthlAutoSave ? 'बंद करें' : 'चालू करें';
    };
    strip.appendChild(tg);
    strip.style.display = 'flex';
  }

  async function loadCaseById(cid, accId) {
    try {
      var res = await fetch(CASES_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'load', accessId: accId, caseId: cid }) });
      var data = await res.json();
      if (data.status !== 'ok') { alert('\u092F\u0939 \u0915\u0947\u0938 \u0906\u092A\u0915\u0940 ID \u0938\u0947 access \u0928\u0939\u0940\u0902 \u0939\u0948\u0964'); return; }
      var conv;
      try { conv = JSON.parse(data.conversation || '[]'); } catch (e2) { conv = []; }
      buildMessages();
      messages = [messages[0]].concat(conv);
      chatStarted = true;
      formScreen.style.display = 'none';
      msgContainer.classList.add('show');
      inputArea.classList.add('show');
      newChatBtn.style.display = 'block';
      if (FULLPAGE_MODE) { saveCaseBtn.style.display = 'inline-block'; casesBtn.style.display = 'inline-block'; reportBtn.style.display = 'inline-block'; }
      msgContainer.innerHTML = '';
      for (var i = 0; i < conv.length; i++) {
        var t = conv[i] && conv[i].parts && conv[i].parts[0] ? conv[i].parts[0].text : '';
        if (!t) continue;
        addMsg(t, conv[i].role === 'user' ? 'user' : 'bot');
      }
      loadedCaseId = cid;
      window._loadedCaseMeta = { name: data.name || '', issue: data.issue || '', mobile: '' };
      showCaseStrip(cid);
      addMsg('📂 \u0915\u0947\u0938 ' + cid + ' \u0932\u094B\u0921 \u0939\u0941\u0906 \u2014 ' + data.name + ' (' + data.issue + ')' + (data.caseStatus === 'Closed' ? ' \u2014 \u2705 \u092C\u0902\u0926 \u0915\u0947\u0938' : '') + '\u0964 \u092A\u0942\u0930\u093E \u0915\u0947\u0938 + \u0926\u0935\u093E \u092F\u093E\u0926 \u0939\u0948\u0964 \u0905\u092C \u0928\u092F\u093E \u0932\u0915\u094D\u0937\u0923 \u092F\u093E follow-up \u092A\u094D\u0930\u0936\u094D\u0928 \u0932\u093F\u0916\u0947\u0902\u0964', 'bot');
      setTimeout(function() { input.focus(); }, 300);
    } catch (err) { alert('\u0915\u0947\u0938 \u0932\u094B\u0921 \u0924\u094D\u0930\u0941\u091F\u093F\u0964'); }
  }

  // ===== Fullpage mode (chat.html) =====
  if (FULLPAGE_MODE) {
    var fpStyle = document.createElement('style');
    fpStyle.textContent = '#asthl-chat-window{position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;max-height:100dvh;border-radius:0;display:flex !important;border:none;}'
      + '#asthl-chat-btn,#asthl-flash,#asthl-chat-close{display:none !important;}'
      + '#asthl-chat-root{pointer-events:auto;}'
      + '#asthl-form-screen{align-items:center;justify-content:center;padding:24px 16px;}'
      + '.asthl-step{flex:0 1 auto;width:100%;max-width:440px;background:#ffffff;border-radius:16px;padding:24px;box-shadow:0 10px 40px rgba(13,148,136,0.18);border:1px solid #ccfbf1;}'
      + '#asthl-chat-messages{width:100%;max-width:760px;margin:0 auto;}'
      + '#asthl-chat-input-area{justify-content:center;}'
      + '#asthl-chat-input-area textarea{max-width:700px;position:static;}';
    document.head.appendChild(fpStyle);
    openChat();
  } else {
    setTimeout(showFlash, FLASH_DELAY);
  }
})();
