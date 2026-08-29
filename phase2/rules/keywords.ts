/**
 * Centralized keyword and synonym tables for the rule-based classifiers,
 * plus a shared deterministic scoring function.
 *
 * Everything here is data, not logic: classifiers consume these tables and
 * the scoring helpers below. Adding a synonym means touching this one file.
 */
import {
  containsPhrase,
  startsWithPhrase,
} from "./normalize.ts";
import type {
  FieldType,
  QuestionCategory,
} from "../schemas/questionSchema.ts";

export interface KeywordRule {
  strong: string[];
  weak?: string[];
}

export interface MatchScore {
  /** Number of matched terms (strong + weak), used for ranking. */
  hits: number;
  /** Deterministic confidence in [0, 1]. */
  confidence: number;
  matchedStrong: string[];
  matchedWeak: string[];
  /** True when the question text starts with a matched phrase. */
  prefix: boolean;
}

export const SCORE = {
  base: 0.15,
  perStrongHit: 0.45,
  perWeakHit: 0.12,
  prefixBonus: 0.15,
  cap: 0.98,
} as const;

/** Below this confidence a rule result is considered too weak to trust. */
export const CLASSIFY_THRESHOLD = 0.5;

export function scoreRule(rule: KeywordRule, text: string): MatchScore {
  const matchedStrong: string[] = [];
  const matchedWeak: string[] = [];
  let strong = 0;
  let weak = 0;

  for (const term of rule.strong ?? []) {
    if (containsPhrase(text, term)) {
      strong += 1;
      matchedStrong.push(term);
    }
  }
  for (const term of rule.weak ?? []) {
    if (containsPhrase(text, term)) {
      weak += 1;
      matchedWeak.push(term);
    }
  }

  const prefix =
    (rule.strong ?? []).some((term) => startsWithPhrase(text, term)) ||
    (rule.weak ?? []).some((term) => startsWithPhrase(text, term));

  const confidence = Math.min(
    SCORE.base +
      strong * SCORE.perStrongHit +
      weak * SCORE.perWeakHit +
      (prefix ? SCORE.prefixBonus : 0),
    SCORE.cap
  );

  return { hits: strong + weak, confidence, matchedStrong, matchedWeak, prefix };
}

export const hasAnyMatch = (score: MatchScore): boolean => score.hits > 0;

/**
 * Same shape as MatchScore but with only `hits`/`confidence` populated;
 * used when a rule matched nothing so callers skip it.
 */
export const noMatch = (): MatchScore => ({
  hits: 0,
  confidence: 0.1,
  matchedStrong: [],
  matchedWeak: [],
  prefix: false,
});

/* ------------------------------------------------------------------ *
 * Question type keywords
 * ------------------------------------------------------------------ */

export const TYPE_EMAIL: KeywordRule = {
  strong: ["email address", "email id", "email", "e-mail", "e mail", "mail id", "mail address"],
};

export const TYPE_NUMBER: KeywordRule = {
  strong: [
    "how many",
    "number of",
    "number of years",
    "years of experience",
    "age in years",
    "what is your age",
    "your age",
    "cgpa",
    "gpa",
    "percentage",
    "marks obtained",
    "score out of",
    "how old are you",
  ],
  weak: ["age", "years", "score", "marks"],
};

export const TYPE_FILE_UPLOAD: KeywordRule = {
  strong: [
    "upload",
    "upload your",
    "attach",
    "attach your",
    "submit file",
    "choose file",
    "add your resume",
    "your resume",
    "resume",
    "cv",
    "supporting document",
    "upload a photo",
  ],
  weak: ["attachment", "document", "scan copy"],
};

export const TYPE_GRID: KeywordRule = {
  strong: ["matrix", "grid table", "grid", "rate the following", "rate each of the following", "for each of the following", "match the following", "table of"],
  weak: ["categorize", "group the following"],
};

export const TYPE_SCALE: KeywordRule = {
  strong: [
    "on a scale",
    "scale of 1",
    "rate from 1",
    "rate from 0",
    "how likely are you to recommend",
    "on a scale of 1 to",
  ],
  weak: ["satisfaction score", "rank from", "score from"],
};

/* ------------------------------------------------------------------ *
 * Question categories
 * ------------------------------------------------------------------ */

export const CATEGORY_KEYWORDS: Record<
  QuestionCategory,
  KeywordRule
> = {
  PERSONAL_DATA: {
    strong: [
      "full name",
      "first name",
      "last name",
      "middle name",
      "your name",
      "email address",
      "email id",
      "email",
      "e-mail",
      "mobile number",
      "mobile no",
      "contact number",
      "contact no",
      "telephone",
      "whatsapp",
      "whatsapp number",
      "phone",
      "mobile",
      "cell",
      "cell number",
      "cell no",
      "address",
      "current city",
      "city",
      "state",
      "country",
      "pincode",
      "pin code",
      "zip code",
      "postal code",
      "date of birth",
      "dob",
      "birth date",
      "birthday",
      "gender",
      "nationality",
    ],
    weak: ["name", "contact", "birth", "occupation", "married", "marital status"],
  },
  USER_CONTEXT: {
    strong: [
      "university",
      "college",
      "school",
      "institute",
      "institution",
      "degree",
      "major",
      "program",
      "course",
      "semester",
      "year of study",
      "year of graduation",
      "graduation year",
      "current year",
      "department",
      "branch",
      "specialization",
      "stream",
      "programming language",
      "technologies",
      "skills",
      "work experience",
      "years of experience",
      "project",
      "internship",
      "job title",
      "current company",
      "employer",
      "designation",
      "industry",
    ],
    weak: [
      "experience",
      "study",
      "studies",
      "expertise",
      "company",
      "role",
      "language",
      "languages",
      "team",
    ],
  },
  KNOWLEDGE: {
    strong: [
      "what is the capital",
      "capital of",
      "what is",
      "what are",
      "define",
      "definition of",
      "which of the following",
      "which of these",
      "which aws",
      "which protocol",
      "which company",
      "which technology",
      "which country",
      "who invented",
      "who founded",
      "who discovered",
      "when was",
      "what year",
      "what does",
      "explain what",
      "different between",
      "true or false",
      "fill in the blank",
      "choose the correct answer",
      "select the correct answer",
      "odd one out",
      "does not belong",
      "how many times",
      "full form",
      "purpose of",
    ],
    weak: [
      "which",
      "what",
      "who",
      "capital",
      "invented",
      "discovered",
      "protocol",
      "service",
      "define",
    ],
  },
  OPINION: {
    strong: [
      "what do you think",
      "do you think",
      "in your opinion",
      "your opinion",
      "how do you feel",
      "do you believe",
      "what are your thoughts",
      "your thoughts",
      "do you agree",
      "agree or disagree",
    ],
    weak: ["think", "opinion", "believe", "feel about", "point of view"],
  },
  FEEDBACK: {
    strong: [
      "how satisfied",
      "satisfaction",
      "feedback",
      "rate your",
      "how likely are you to recommend",
      "would you recommend",
      "how was your experience",
      "how did you enjoy",
      "overall experience",
      "what could we improve",
      "suggestions for improvement",
      "suggestions to improve",
      "improvements",
      "complaint",
      "rating",
    ],
    weak: ["experience", "improve", "satisfied", "helpful", "useful", "recommend", "service"],
  },
  PREFERENCE: {
    strong: [
      "prefer",
      "preferred",
      "would you rather",
      "favorite",
      "favourite",
      "which option do you prefer",
      "which do you prefer",
      "select your preferred",
      "what would you like",
      "most important to you",
      "your choice",
      "easy to use",
    ],
    weak: ["choose", "pick", "choice", "like the most", "preference"],
  },
  DATE_TIME: {
    strong: [
      "what date",
      "which date",
      "start date",
      "end date",
      "arrival date",
      "departure date",
      "date",
      "what time",
      "which time",
      "preferred time",
      "time slot",
      "start time",
      "what day",
      "which day",
      "when are you available",
      "available on",
    ],
    weak: ["when", "day", "month", "year", "time", "timing", "schedule"],
  },
  REFERENCE_DATA: {
    strong: [
      "registration number",
      "registration no",
      "reg no",
      "reg number",
      "roll number",
      "roll no",
      "enrollment number",
      "enrolment number",
      "enrollment id",
      "student id",
      "student number",
      "employee id",
      "employee number",
      "reference number",
      "reference id",
      "ref no",
      "ticket number",
      "ticket id",
      "booking id",
      "booking reference",
      "transaction id",
      "order id",
      "order number",
      "invoice number",
      "invoice id",
      "admission number",
      "hall ticket number",
      "seat number",
      "pan number",
      "unique id",
      "id number",
      "account number",
      "tracking number",
    ],
    weak: ["reference", "registration", "enrollment", "enrolment", "roll", "id"],
  },
  UNKNOWN: { strong: [] },
};

/** Priority order used to break score ties while choosing a category. */
export const CATEGORY_PRIORITY: QuestionCategory[] = [
  "PERSONAL_DATA",
  "USER_CONTEXT",
  "REFERENCE_DATA",
  "KNOWLEDGE",
  "FEEDBACK",
  "PREFERENCE",
  "OPINION",
  "DATE_TIME",
  "UNKNOWN",
];

/* ------------------------------------------------------------------ *
 * Personal / reference fields
 * ------------------------------------------------------------------ */

export const FIELD_KEYWORDS: Record<FieldType, KeywordRule> = {
  NAME: {
    strong: ["full name", "your name", "first name", "last name", "middle name", "beneficiary name", "nominee name", "name"],
    weak: ["surname", "initials"],
  },
  EMAIL: {
    strong: ["email address", "email id", "email", "e-mail", "e mail", "mail id", "mail address"],
    weak: ["mail"],
  },
  PHONE: {
    strong: [
      "phone number",
      "phone no",
      "phone",
      "mobile number",
      "mobile no",
      "contact number",
      "contact no",
      "contact phone",
      "telephone",
      "cell number",
      "cell no",
      "whatsapp number",
      "whatsapp",
      "landline",
      "mobile",
    ],
    weak: ["contact", "teleph", "cell"],
  },
  ADDRESS: {
    strong: [
      "address",
      "residential address",
      "permanent address",
      "current address",
      "billing address",
      "shipping address",
      "address line",
      "street address",
      "street",
      "locality",
      "house number",
      "flat number",
    ],
    weak: ["location", "residence"],
  },
  CITY: { strong: ["city", "current city", "city of residence", "hometown", "town", "district"], weak: [] },
  STATE: { strong: ["state", "province", "state/ut", "region state"], weak: ["region"] },
  COUNTRY: { strong: ["country", "country of residence", "citizenship", "nation"], weak: ["nationality"] },
  DATE: {
    strong: [
      "date of birth",
      "dob",
      "birth date",
      "birthday",
      "start date",
      "end date",
      "arrival date",
      "departure date",
      "date",
    ],
    weak: ["day", "month", "year"],
  },
  TIME: {
    strong: ["what time", "preferred time", "arrival time", "departure time", "start time", "time slot", "time"],
    weak: ["slot", "timing"],
  },
  REFERENCE_NUMBER: {
    strong: [
      "registration number",
      "registration no",
      "reg no",
      "reg number",
      "roll number",
      "roll no",
      "enrollment number",
      "enrolment number",
      "student id",
      "student number",
      "employee id",
      "employee number",
      "reference number",
      "reference id",
      "ticket number",
      "order id",
      "invoice number",
      "pan number",
      "aadhaar number",
      "aadhar number",
      "hall ticket number",
      "seat number",
      "admission number",
      "unique id",
      "id number",
      "account number",
      "tracking number",
    ],
    weak: ["registration", "enrollment", "enrolment", "roll", "reference", "id"],
  },
  COLLEGE: { strong: ["college", "college name", "college/university", "institute"], weak: ["institution"] },
  UNIVERSITY: { strong: ["university", "university name", "name of university", "college or university"], weak: ["school"] },
  DEGREE: {
    strong: ["degree", "course", "program", "major", "specialization", "qualification", "field of study", "branch", "stream", "department"],
    weak: ["enrolled in", "studying"],
  },
  OTHER: { strong: [], weak: [] },
  NONE: { strong: [], weak: [] },
};

/** First field that scores above "no match" wins (most specific first). */
export const FIELD_PRIORITY: FieldType[] = [
  "UNIVERSITY",
  "COLLEGE",
  "DEGREE",
  "EMAIL",
  "PHONE",
  "REFERENCE_NUMBER",
  "COUNTRY",
  "STATE",
  "CITY",
  "ADDRESS",
  "DATE",
  "TIME",
  "NAME",
  "OTHER",
  "NONE",
];

/** Categories where assigning a specific profile field makes sense. */
export const FIELD_ELIGIBLE_CATEGORIES: QuestionCategory[] = [
  "PERSONAL_DATA",
  "USER_CONTEXT",
  "REFERENCE_DATA",
  "DATE_TIME",
];