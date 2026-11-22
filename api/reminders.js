// Scheduled reminders are deliberately disabled in this new survey until
// the privacy review, explicit reminder consent, and Resend credentials are ready.
export default function handler(req,res){res.statusCode=501;res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({error:'Reminders are not enabled for this assessment.'}));}
