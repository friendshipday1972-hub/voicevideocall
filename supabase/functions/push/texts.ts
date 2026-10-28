// Notification texts in the app's 8 languages. `{name}` and `{amount}` are filled in.
// Have native speakers review these along with the app's own translations.

export type Lang = 'en' | 'hi' | 'te' | 'ta' | 'kn' | 'ml' | 'bn' | 'mr';

type Texts = {
  callTitle: string;
  voiceBody: string;
  videoBody: string;
  missedTitle: string;
  missedBody: string;
  missedOfflineBody: string;
  approvedTitle: string;
  approvedBody: string;
  rejectedTitle: string;
  rejectedBody: string;
  paidTitle: string;
  paidBody: string;
  payoutRejectedTitle: string;
  payoutRejectedBody: string;
};

export const texts: Record<Lang, Texts> = {
  en: {
    callTitle: '{name} is calling',
    voiceBody: 'Voice call · tap to answer',
    videoBody: 'Video call · tap to answer',
    missedTitle: 'Missed call from {name}',
    missedBody: 'Missed calls lower your answer rate.',
    missedOfflineBody: 'You’ve been set offline. Open the app and go online when you’re free.',
    approvedTitle: 'You’re verified!',
    approvedBody: 'Welcome aboard. Go online to start receiving calls.',
    rejectedTitle: 'Your verification needs changes',
    rejectedBody: 'Open the app to see what to fix.',
    paidTitle: 'Payout sent',
    paidBody: '₹{amount} is on its way to your account.',
    payoutRejectedTitle: 'Payout request declined',
    payoutRejectedBody: 'Open the app for details.',
  },
  hi: {
    callTitle: '{name} कॉल कर रहे हैं',
    voiceBody: 'वॉइस कॉल · जवाब देने के लिए टैप करें',
    videoBody: 'वीडियो कॉल · जवाब देने के लिए टैप करें',
    missedTitle: '{name} की मिस्ड कॉल',
    missedBody: 'मिस्ड कॉल से आपका आंसर रेट कम होता है।',
    missedOfflineBody: 'आपको ऑफ़लाइन कर दिया गया है। फ़्री होने पर ऐप खोलकर ऑनलाइन हो जाएँ।',
    approvedTitle: 'आपका वेरिफ़िकेशन हो गया!',
    approvedBody: 'स्वागत है। कॉल पाने के लिए ऑनलाइन हो जाएँ।',
    rejectedTitle: 'वेरिफ़िकेशन में बदलाव चाहिए',
    rejectedBody: 'क्या ठीक करना है, यह देखने के लिए ऐप खोलें।',
    paidTitle: 'पेआउट भेज दिया गया',
    paidBody: '₹{amount} आपके खाते में भेजे जा रहे हैं।',
    payoutRejectedTitle: 'पेआउट अनुरोध अस्वीकार हुआ',
    payoutRejectedBody: 'जानकारी के लिए ऐप खोलें।',
  },
  te: {
    callTitle: '{name} కాల్ చేస్తున్నారు',
    voiceBody: 'వాయిస్ కాల్ · జవాబు ఇవ్వడానికి నొక్కండి',
    videoBody: 'వీడియో కాల్ · జవాబు ఇవ్వడానికి నొక్కండి',
    missedTitle: '{name} నుండి మిస్డ్ కాల్',
    missedBody: 'మిస్డ్ కాల్స్ వల్ల మీ ఆన్సర్ రేట్ తగ్గుతుంది.',
    missedOfflineBody: 'మిమ్మల్ని ఆఫ్‌లైన్‌గా మార్చాం. ఖాళీగా ఉన్నప్పుడు యాప్ తెరిచి ఆన్‌లైన్ అవ్వండి.',
    approvedTitle: 'మీ వెరిఫికేషన్ పూర్తయింది!',
    approvedBody: 'స్వాగతం. కాల్స్ రావడానికి ఆన్‌లైన్ అవ్వండి.',
    rejectedTitle: 'వెరిఫికేషన్‌లో మార్పులు అవసరం',
    rejectedBody: 'ఏమి సరిచేయాలో చూడటానికి యాప్ తెరవండి.',
    paidTitle: 'పేఅవుట్ పంపబడింది',
    paidBody: '₹{amount} మీ ఖాతాకు పంపుతున్నాం.',
    payoutRejectedTitle: 'పేఅవుట్ అభ్యర్థన తిరస్కరించబడింది',
    payoutRejectedBody: 'వివరాల కోసం యాప్ తెరవండి.',
  },
  ta: {
    callTitle: '{name} அழைக்கிறார்',
    voiceBody: 'குரல் அழைப்பு · பதிலளிக்க தட்டவும்',
    videoBody: 'வீடியோ அழைப்பு · பதிலளிக்க தட்டவும்',
    missedTitle: '{name} இடமிருந்து தவறிய அழைப்பு',
    missedBody: 'தவறிய அழைப்புகள் உங்கள் பதில் விகிதத்தைக் குறைக்கும்.',
    missedOfflineBody: 'நீங்கள் ஆஃப்லைனுக்கு மாற்றப்பட்டீர்கள். நேரம் இருக்கும்போது ஆப்பைத் திறந்து ஆன்லைனுக்கு வாருங்கள்.',
    approvedTitle: 'உங்கள் சரிபார்ப்பு முடிந்தது!',
    approvedBody: 'வரவேற்கிறோம். அழைப்புகளைப் பெற ஆன்லைனுக்கு வாருங்கள்.',
    rejectedTitle: 'சரிபார்ப்பில் மாற்றங்கள் தேவை',
    rejectedBody: 'எதைச் சரிசெய்ய வேண்டும் என்று பார்க்க ஆப்பைத் திறக்கவும்.',
    paidTitle: 'பணம் அனுப்பப்பட்டது',
    paidBody: '₹{amount} உங்கள் கணக்கிற்கு அனுப்பப்படுகிறது.',
    payoutRejectedTitle: 'பணம் எடுக்கும் கோரிக்கை நிராகரிக்கப்பட்டது',
    payoutRejectedBody: 'விவரங்களுக்கு ஆப்பைத் திறக்கவும்.',
  },
  kn: {
    callTitle: '{name} ಕರೆ ಮಾಡುತ್ತಿದ್ದಾರೆ',
    voiceBody: 'ಧ್ವನಿ ಕರೆ · ಉತ್ತರಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ',
    videoBody: 'ವೀಡಿಯೊ ಕರೆ · ಉತ್ತರಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ',
    missedTitle: '{name} ಅವರಿಂದ ಮಿಸ್ಡ್ ಕಾಲ್',
    missedBody: 'ಮಿಸ್ಡ್ ಕಾಲ್‌ಗಳು ನಿಮ್ಮ ಉತ್ತರ ದರವನ್ನು ಕಡಿಮೆ ಮಾಡುತ್ತವೆ.',
    missedOfflineBody: 'ನಿಮ್ಮನ್ನು ಆಫ್‌ಲೈನ್ ಮಾಡಲಾಗಿದೆ. ಬಿಡುವಾದಾಗ ಆ್ಯಪ್ ತೆರೆದು ಆನ್‌ಲೈನ್ ಆಗಿ.',
    approvedTitle: 'ನಿಮ್ಮ ಪರಿಶೀಲನೆ ಪೂರ್ಣಗೊಂಡಿದೆ!',
    approvedBody: 'ಸ್ವಾಗತ. ಕರೆಗಳನ್ನು ಪಡೆಯಲು ಆನ್‌ಲೈನ್ ಆಗಿ.',
    rejectedTitle: 'ಪರಿಶೀಲನೆಯಲ್ಲಿ ಬದಲಾವಣೆಗಳು ಬೇಕು',
    rejectedBody: 'ಏನು ಸರಿಪಡಿಸಬೇಕು ಎಂದು ನೋಡಲು ಆ್ಯಪ್ ತೆರೆಯಿರಿ.',
    paidTitle: 'ಪಾವತಿ ಕಳುಹಿಸಲಾಗಿದೆ',
    paidBody: '₹{amount} ನಿಮ್ಮ ಖಾತೆಗೆ ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ.',
    payoutRejectedTitle: 'ಪಾವತಿ ವಿನಂತಿ ತಿರಸ್ಕರಿಸಲಾಗಿದೆ',
    payoutRejectedBody: 'ವಿವರಗಳಿಗಾಗಿ ಆ್ಯಪ್ ತೆರೆಯಿರಿ.',
  },
  ml: {
    callTitle: '{name} വിളിക്കുന്നു',
    voiceBody: 'വോയ്സ് കോൾ · മറുപടി നൽകാൻ ടാപ്പ് ചെയ്യുക',
    videoBody: 'വീഡിയോ കോൾ · മറുപടി നൽകാൻ ടാപ്പ് ചെയ്യുക',
    missedTitle: '{name} ൽ നിന്ന് മിസ്ഡ് കോൾ',
    missedBody: 'മിസ്ഡ് കോളുകൾ നിങ്ങളുടെ മറുപടി നിരക്ക് കുറയ്ക്കും.',
    missedOfflineBody: 'നിങ്ങളെ ഓഫ്‌ലൈനാക്കി. സമയമുള്ളപ്പോൾ ആപ്പ് തുറന്ന് ഓൺലൈനാകൂ.',
    approvedTitle: 'നിങ്ങളുടെ വെരിഫിക്കേഷൻ പൂർത്തിയായി!',
    approvedBody: 'സ്വാഗതം. കോളുകൾ ലഭിക്കാൻ ഓൺലൈനാകൂ.',
    rejectedTitle: 'വെരിഫിക്കേഷനിൽ മാറ്റങ്ങൾ വേണം',
    rejectedBody: 'എന്താണ് ശരിയാക്കേണ്ടതെന്ന് കാണാൻ ആപ്പ് തുറക്കൂ.',
    paidTitle: 'പേഔട്ട് അയച്ചു',
    paidBody: '₹{amount} നിങ്ങളുടെ അക്കൗണ്ടിലേക്ക് അയയ്ക്കുന്നു.',
    payoutRejectedTitle: 'പേഔട്ട് അഭ്യർത്ഥന നിരസിച്ചു',
    payoutRejectedBody: 'വിശദാംശങ്ങൾക്ക് ആപ്പ് തുറക്കൂ.',
  },
  bn: {
    callTitle: '{name} কল করছেন',
    voiceBody: 'ভয়েস কল · উত্তর দিতে ট্যাপ করুন',
    videoBody: 'ভিডিও কল · উত্তর দিতে ট্যাপ করুন',
    missedTitle: '{name}-এর মিসড কল',
    missedBody: 'মিসড কল আপনার উত্তরের হার কমিয়ে দেয়।',
    missedOfflineBody: 'আপনাকে অফলাইন করা হয়েছে। সময় পেলে অ্যাপ খুলে অনলাইন হন।',
    approvedTitle: 'আপনার যাচাই সম্পূর্ণ হয়েছে!',
    approvedBody: 'স্বাগতম। কল পেতে অনলাইন হন।',
    rejectedTitle: 'যাচাইয়ে কিছু পরিবর্তন দরকার',
    rejectedBody: 'কী ঠিক করতে হবে দেখতে অ্যাপ খুলুন।',
    paidTitle: 'পেআউট পাঠানো হয়েছে',
    paidBody: '₹{amount} আপনার অ্যাকাউন্টে পাঠানো হচ্ছে।',
    payoutRejectedTitle: 'পেআউটের অনুরোধ বাতিল হয়েছে',
    payoutRejectedBody: 'বিস্তারিত জানতে অ্যাপ খুলুন।',
  },
  mr: {
    callTitle: '{name} कॉल करत आहेत',
    voiceBody: 'व्हॉइस कॉल · उत्तर देण्यासाठी टॅप करा',
    videoBody: 'व्हिडिओ कॉल · उत्तर देण्यासाठी टॅप करा',
    missedTitle: '{name} यांचा मिस्ड कॉल',
    missedBody: 'मिस्ड कॉलमुळे तुमचा उत्तर दर कमी होतो.',
    missedOfflineBody: 'तुम्हाला ऑफलाइन केले आहे. वेळ असेल तेव्हा ॲप उघडून ऑनलाइन व्हा.',
    approvedTitle: 'तुमची पडताळणी पूर्ण झाली!',
    approvedBody: 'स्वागत आहे. कॉल मिळवण्यासाठी ऑनलाइन व्हा.',
    rejectedTitle: 'पडताळणीत बदल आवश्यक आहेत',
    rejectedBody: 'काय दुरुस्त करायचे ते पाहण्यासाठी ॲप उघडा.',
    paidTitle: 'पेआउट पाठवले',
    paidBody: '₹{amount} तुमच्या खात्यात पाठवले जात आहेत.',
    payoutRejectedTitle: 'पेआउट विनंती नाकारली',
    payoutRejectedBody: 'तपशीलासाठी ॲप उघडा.',
  },
};

export function textsFor(lang: string | null | undefined): Texts {
  return texts[(lang ?? 'en') as Lang] ?? texts.en;
}

export const fill = (s: string, vars: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
