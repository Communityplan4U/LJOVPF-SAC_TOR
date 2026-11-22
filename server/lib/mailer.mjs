/* Resend integration. This is server-only and defaults to off until configured.
 * It sends a private return link only after a person has supplied an email
 * address; it does not subscribe them to updates without separate consent. */
export async function sendPrivateReturnLink(email, id, token) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  const publicUrl = process.env.PUBLIC_URL;
  if (!apiKey || !from || !publicUrl || process.env.RETURN_LINK_EMAIL_ENABLED !== 'true') return {status:'disabled'};
  if (!email || !id || !token) return {status:'skipped'};
  const base = new URL(publicUrl);
  if (base.protocol !== 'https:') return {status:'invalid_public_url'};
  const link = base.origin + base.pathname.replace(/\/$/, '') + '/#resume=' + encodeURIComponent(id + '.' + token);
  const reply = process.env.RESEND_REPLY_TO;
  const payload = {
    from,
    to:[email],
    subject:'Your Little Jamaica SAC Terms of Reference assessment return link',
    text:'Thank you for contributing to Community in Public\'s independent Little Jamaica SAC Terms of Reference assessment.\n\nYou can revisit or revise your assessment using this private link:\n'+link+'\n\nAnyone with this link can access your response. Keep it private.\n\nThis email does not subscribe you to any newsletter or updates unless you separately selected those options.'
  };
  if (reply) payload.reply_to = reply;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:'POST',
      headers:{Authorization:'Bearer '+apiKey, 'Content-Type':'application/json'},
      body:JSON.stringify(payload),
      signal:AbortSignal.timeout(6500),
      redirect:'error'
    });
    return {status:res.ok?'sent':'failed'};
  } catch {return {status:'failed'};}
}
