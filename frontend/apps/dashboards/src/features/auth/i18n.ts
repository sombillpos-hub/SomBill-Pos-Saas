import { useCallback, useEffect, useState } from 'react';

export type Lang = 'en' | 'so' | 'ar';
export const LANGS: { id: Lang; short: string; name: string }[] = [
  { id: 'en', short: 'EN', name: 'English' },
  { id: 'so', short: 'SO', name: 'Soomaali' },
  { id: 'ar', short: 'AR', name: 'العربية' },
];

const en = {
  install: 'Install App',
  language: 'Language',
  welcome: 'Welcome Back!',
  subtitle: 'Sign in to access your SomBill POS dashboard',
  email: 'Email address',
  emailPh: 'name@sombill.com or your-email@gmail.com',
  password: 'Password',
  passwordPh: 'Enter your password',
  forgot: 'Forgot password?',
  showPw: 'Show password',
  hidePw: 'Hide password',
  caps: 'Caps Lock is on',
  remember: 'Remember me',
  keepSigned: 'Keep me signed in',
  signIn: 'Sign In to SomBill',
  signingIn: 'Signing in…',
  orWith: 'or continue with',
  google: 'Google',
  helpTitle: 'Need technical assistance?',
  helpText: '24/7 Hospitality Support',
  contact: 'Contact Support',
  menu: 'View Customer Public Menu',
  copyright: '© 2026 SomBill Hospitality OS · Somaliland & East Africa. All rights reserved.',
  online: 'Connected',
  offline: 'You are offline',
  notConfigured: 'Supabase is not configured. Copy .env.example to .env.local and set your project URL and anon key.',
  badEmail: 'Enter a valid email address',
  needPassword: 'Enter your password',
  showcaseTagline: 'Smart POS. Smooth Operations.',
  showcaseBody:
    'Power your restaurant business with SomBill OS: fast touch billing, live kitchen and branch updates, and Zaad, EVC Plus and Somtel Money payments.',
  f1t: 'Fast POS',
  f1d: 'Instant touch billing',
  f2t: 'Secure & Audited',
  f2d: 'Role-based access, every change logged',
  f3t: 'Real-Time HQ',
  f3d: 'Live branch numbers',
  forgotTitle: 'Reset Your Password',
  forgotSub: 'Enter your registered email address to receive a verification code (OTP).',
  sendCode: 'Send Reset Code (OTP)',
  sending: 'Sending…',
  codeTitle: 'Enter the 6-digit code',
  codeSub: 'We sent a code to {email}. The email also contains a reset link you can use instead.',
  codeLabel: 'Verification code',
  digit: 'Digit {n}',
  verify: 'Verify Code',
  verifying: 'Verifying…',
  resendIn: 'Resend in {time}',
  resend: 'Resend code',
  codeBad: 'That code is not valid or has expired. Check the code or request a new one.',
  sent: 'Code sent. Check your inbox and spam folder.',
  back: 'Back to Sign In',
  newTitle: 'Choose a new password',
  newSub: 'Use at least 10 characters with a letter and a number.',
  newPw: 'New password',
  confirmPw: 'Confirm password',
  savePw: 'Save password',
  saving: 'Saving…',
  pwShort: 'Use at least 10 characters',
  pwLetter: 'Include a letter',
  pwNumber: 'Include a number',
  pwMatch: 'Passwords do not match',
  linkTitle: 'Set your password',
  linkInvalid:
    'This link is invalid or has expired. Ask your manager to send a new one, or use “Forgot password” on the sign-in page.',
};
export type Dict = typeof en;

const so: Dict = {
  install: 'Ku rakib App-ka',
  language: 'Luqadda',
  welcome: 'Ku soo dhawaaw mar kale!',
  subtitle: 'Gal si aad u furto dashboard-kaaga SomBill POS',
  email: 'Cinwaanka email-ka',
  emailPh: 'name@sombill.com ama email-kaaga@gmail.com',
  password: 'Erayga sirta ah',
  passwordPh: 'Geli erayga sirta ah',
  forgot: 'Ma ilowday erayga sirta ah?',
  showPw: 'Muuji erayga sirta ah',
  hidePw: 'Qari erayga sirta ah',
  caps: 'Caps Lock waa shidan yahay',
  remember: 'I xusuuso',
  keepSigned: 'I sii daa anigoo gashan',
  signIn: 'Gal SomBill',
  signingIn: 'Waa la gelayaa…',
  orWith: 'ama ku sii wad',
  google: 'Google',
  helpTitle: 'Ma u baahan tahay caawimaad farsamo?',
  helpText: 'Taageero 24/7 ah',
  contact: 'La xiriir Taageerada',
  menu: 'Eeg Menu-ga Macaamiisha',
  copyright: '© 2026 SomBill Hospitality OS · Soomaaliland & Bariga Afrika. Xuquuqda oo dhan waa dhawran tahay.',
  online: 'Xiriir ayaa jira',
  offline: 'Internet ma haysid',
  notConfigured:
    'Supabase lama habeynin. Nuqul ka samee .env.example una beddel .env.local, kaddibna geli URL-ka iyo anon key.',
  badEmail: 'Geli email sax ah',
  needPassword: 'Geli erayga sirta ah',
  showcaseTagline: 'POS caqli leh. Shaqo siman.',
  showcaseBody:
    'Ku xoojiso ganacsigaaga makhaayadda SomBill OS: qaabilaad degdeg ah, wararka jikada iyo laamaha oo toos ah, iyo lacag bixinta Zaad, EVC Plus iyo Somtel Money.',
  f1t: 'POS Degdeg ah',
  f1d: 'Biil bixin taabasho ah',
  f2t: 'Amaan & La Hubiyo',
  f2d: 'Rukhsad door ah, isbeddel kasta waa la diiwaangeliyaa',
  f3t: 'HQ Toos ah',
  f3d: 'Tirooyinka laamaha oo toos ah',
  forgotTitle: 'Dib u deji erayga sirta ah',
  forgotSub: 'Geli email-ka aad diiwaangelisay si aad u hesho koodh xaqiijin ah (OTP).',
  sendCode: 'Dir Koodhka (OTP)',
  sending: 'Waa la dirayaa…',
  codeTitle: 'Geli koodhka 6-ka lambar ah',
  codeSub: 'Koodh ayaan u dirnay {email}. Email-ku wuxuu kaloo leeyahay link aad isticmaali karto.',
  codeLabel: 'Koodhka xaqiijinta',
  digit: 'Lambarka {n}',
  verify: 'Xaqiiji Koodhka',
  verifying: 'Waa la xaqiijinayaa…',
  resendIn: 'Dib u dir {time} kadib',
  resend: 'Dib u dir koodhka',
  codeBad: 'Koodhkaasi ma shaqeynayo ama wuu dhacay. Hubi koodhka ama codso mid cusub.',
  sent: 'Koodh waa la diray. Hubi inbox-ka iyo spam-ka.',
  back: 'Ku laabo Gelitaanka',
  newTitle: 'Dooro erayga sirta ah ee cusub',
  newSub: 'Isticmaal ugu yaraan 10 xaraf oo leh xaraf iyo lambar.',
  newPw: 'Erayga sirta ah ee cusub',
  confirmPw: 'Xaqiiji erayga sirta ah',
  savePw: 'Kaydi erayga sirta ah',
  saving: 'Waa la kaydinayaa…',
  pwShort: 'Isticmaal ugu yaraan 10 xaraf',
  pwLetter: 'Ku dar xaraf',
  pwNumber: 'Ku dar lambar',
  pwMatch: 'Erayada sirta ah ma isle’eg yihiin',
  linkTitle: 'Dejiso erayga sirta ah',
  linkInvalid:
    'Linkigan ma shaqeynayo ama wuu dhacay. Weydii maamulahaaga mid cusub, ama isticmaal “Ma ilowday erayga sirta ah” bogga gelitaanka.',
};

const ar: Dict = {
  install: 'تثبيت التطبيق',
  language: 'اللغة',
  welcome: 'مرحباً بعودتك!',
  subtitle: 'سجّل الدخول للوصول إلى لوحة SomBill POS',
  email: 'البريد الإلكتروني',
  emailPh: 'name@sombill.com أو your-email@gmail.com',
  password: 'كلمة المرور',
  passwordPh: 'أدخل كلمة المرور',
  forgot: 'نسيت كلمة المرور؟',
  showPw: 'إظهار كلمة المرور',
  hidePw: 'إخفاء كلمة المرور',
  caps: 'مفتاح Caps Lock مفعّل',
  remember: 'تذكّرني',
  keepSigned: 'أبقني مسجّلاً',
  signIn: 'الدخول إلى SomBill',
  signingIn: 'جارٍ تسجيل الدخول…',
  orWith: 'أو تابع باستخدام',
  google: 'Google',
  helpTitle: 'تحتاج إلى مساعدة تقنية؟',
  helpText: 'دعم الضيافة على مدار الساعة',
  contact: 'تواصل مع الدعم',
  menu: 'عرض قائمة الزبائن',
  copyright: '© 2026 SomBill Hospitality OS · أرض الصومال وشرق أفريقيا. جميع الحقوق محفوظة.',
  online: 'متصل',
  offline: 'أنت غير متصل بالإنترنت',
  notConfigured: 'لم يتم إعداد Supabase. انسخ .env.example إلى .env.local وأدخل عنوان المشروع والمفتاح.',
  badEmail: 'أدخل بريداً إلكترونياً صحيحاً',
  needPassword: 'أدخل كلمة المرور',
  showcaseTagline: 'نقطة بيع ذكية. عمليات سلسة.',
  showcaseBody:
    'عزّز مطعمك مع SomBill OS: فوترة سريعة باللمس، وتحديثات مباشرة للمطبخ والفروع، ودفعات Zaad وEVC Plus وSomtel Money.',
  f1t: 'نقطة بيع سريعة',
  f1d: 'فوترة فورية باللمس',
  f2t: 'آمن ومُدقَّق',
  f2d: 'صلاحيات حسب الدور وتسجيل كل تغيير',
  f3t: 'مقر رئيسي مباشر',
  f3d: 'أرقام الفروع لحظة بلحظة',
  forgotTitle: 'إعادة تعيين كلمة المرور',
  forgotSub: 'أدخل بريدك الإلكتروني المسجّل لتصلك رسالة برمز تحقق (OTP).',
  sendCode: 'إرسال رمز التحقق (OTP)',
  sending: 'جارٍ الإرسال…',
  codeTitle: 'أدخل الرمز المكوّن من 6 أرقام',
  codeSub: 'أرسلنا رمزاً إلى {email}. تحتوي الرسالة أيضاً على رابط يمكنك استخدامه.',
  codeLabel: 'رمز التحقق',
  digit: 'الرقم {n}',
  verify: 'تحقق من الرمز',
  verifying: 'جارٍ التحقق…',
  resendIn: 'إعادة الإرسال بعد {time}',
  resend: 'إعادة إرسال الرمز',
  codeBad: 'الرمز غير صالح أو منتهي. تحقق منه أو اطلب رمزاً جديداً.',
  sent: 'تم إرسال الرمز. تحقق من الوارد والرسائل غير المرغوبة.',
  back: 'العودة لتسجيل الدخول',
  newTitle: 'اختر كلمة مرور جديدة',
  newSub: 'استخدم 10 أحرف على الأقل تتضمن حرفاً ورقماً.',
  newPw: 'كلمة المرور الجديدة',
  confirmPw: 'تأكيد كلمة المرور',
  savePw: 'حفظ كلمة المرور',
  saving: 'جارٍ الحفظ…',
  pwShort: 'استخدم 10 أحرف على الأقل',
  pwLetter: 'أضف حرفاً',
  pwNumber: 'أضف رقماً',
  pwMatch: 'كلمتا المرور غير متطابقتين',
  linkTitle: 'عيّن كلمة المرور',
  linkInvalid: 'هذا الرابط غير صالح أو منتهي. اطلب رابطاً جديداً من مديرك أو استخدم «نسيت كلمة المرور» في صفحة الدخول.',
};

const DICTS: Record<Lang, Dict> = { en, so, ar };
const KEY = 'sombill.lang';

function readLang(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'en' || v === 'so' || v === 'ar') return v;
  } catch {
    /* storage unavailable */
  }
  return 'en';
}

/** Language for the sign-in screens only (English by default). The rest of the app stays in English. */
export function useAuthLang() {
  const [lang, setLangState] = useState<Lang>(readLang);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* storage unavailable */
    }
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute('data-auth-lang', lang);
    return () => document.documentElement.removeAttribute('data-auth-lang');
  }, [lang]);
  const d = DICTS[lang];
  const t = useCallback(
    (k: keyof Dict, vars?: Record<string, string | number>) =>
      Object.entries(vars ?? {}).reduce((s, [a, b]) => s.replace(`{${a}}`, String(b)), d[k]),
    [d],
  );
  return { lang, setLang, t, dir: lang === 'ar' ? ('rtl' as const) : ('ltr' as const) };
}
export type AuthLang = ReturnType<typeof useAuthLang>;
