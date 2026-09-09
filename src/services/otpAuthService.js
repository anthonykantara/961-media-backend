const crypto = require('crypto');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const jwt = require('jsonwebtoken');
const { query } = require('../db');
const secretsManager = require('./secretsManager');
const OTP_LENGTH = 6;
const OTP_REQUEST_WINDOW_MINUTES = 15;
const DEFAULT_OTP_TTL_MINUTES = 10;
const DEFAULT_MAX_OTP_ATTEMPTS = 5;
const DEFAULT_MAX_OTP_REQUESTS = 3;
const DEFAULT_SESSION_TTL = '8h';
const ses = new SESClient({ region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1' });
function normalizeEmail(email){return String(email||'').trim().toLowerCase();}
function validEmail(email){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);}
function generateOtp(){return crypto.randomInt(0,10**OTP_LENGTH).toString().padStart(OTP_LENGTH,'0');}
async function getAuthConfig(){
  return {
    otpTtlMinutes: Number(await secretsManager.getAppSecretField('AUTH_OTP_TTL_MINUTES', process.env.AUTH_OTP_TTL_MINUTES || DEFAULT_OTP_TTL_MINUTES)),
    maxOtpAttempts: Number(await secretsManager.getAppSecretField('AUTH_OTP_MAX_ATTEMPTS', process.env.AUTH_OTP_MAX_ATTEMPTS || DEFAULT_MAX_OTP_ATTEMPTS)),
    maxOtpRequests: Number(await secretsManager.getAppSecretField('AUTH_OTP_MAX_REQUESTS', process.env.AUTH_OTP_MAX_REQUESTS || DEFAULT_MAX_OTP_REQUESTS)),
    sessionTtl: await secretsManager.getAppSecretField('AUTH_SESSION_TTL', process.env.AUTH_SESSION_TTL || DEFAULT_SESSION_TTL),
    otpPepper: await secretsManager.getAppSecretField('AUTH_OTP_PEPPER', process.env.AUTH_OTP_PEPPER || process.env.JWT_SECRET || ''),
    jwtSecret: await secretsManager.getAppSecretField('JWT_SECRET', process.env.JWT_SECRET || ''),
    emailFrom: await secretsManager.getAppSecretField('AUTH_EMAIL_FROM', process.env.AUTH_EMAIL_FROM || ''),
    adminEmails: await secretsManager.getAppSecretField('CMS_ADMIN_EMAILS', process.env.CMS_ADMIN_EMAILS || '')
  };
}
function timingSafeEqualHex(a,b){const left=Buffer.from(a,'hex');const right=Buffer.from(b,'hex');return left.length===right.length&&crypto.timingSafeEqual(left,right);}
async function hashOtp(code){const config=await getAuthConfig();if(!config.otpPepper)throw new Error('AUTH_OTP_PEPPER or JWT_SECRET must be configured');return crypto.createHmac('sha256',config.otpPepper).update(String(code)).digest('hex');}
async function getJwtSecret(){const secret=(await getAuthConfig()).jwtSecret;if(!secret||secret.length<32)throw new Error('JWT_SECRET must be configured with at least 32 characters');return secret;}
async function getUserByEmail(email){const result=await query('SELECT id, email, role, display_name, identity_provider, identity_subject, is_active FROM users WHERE email = $1 LIMIT 1',[normalizeEmail(email)]);return result&&result.rows[0]?result.rows[0]:null;}
async function requestOtp(email){const normalizedEmail=normalizeEmail(email);if(!validEmail(normalizedEmail)){const e=new Error('Enter a valid email address');e.status=400;throw e;}const user=await getUserByEmail(normalizedEmail);if(!user||!user.is_active||user.role==='user'){const e=new Error('This email is not authorized to access the CMS');e.status=403;throw e;}const config=await getAuthConfig();const rateResult=await query("SELECT COUNT(*)::int AS count FROM auth_otps WHERE user_id = $1 AND created_at > NOW() - ($2::int * INTERVAL '1 minute')",[user.id,OTP_REQUEST_WINDOW_MINUTES]);if(rateResult&&rateResult.rows[0].count>=config.maxOtpRequests){const e=new Error('Too many code requests. Please wait a few minutes and try again.');e.status=429;throw e;}await query('UPDATE auth_otps SET consumed_at = NOW() WHERE user_id = $1 AND consumed_at IS NULL',[user.id]);const code=generateOtp();const expiresAt=new Date(Date.now()+config.otpTtlMinutes*60*1000);await query('INSERT INTO auth_otps (user_id,code_hash,expires_at) VALUES ($1,$2,$3)',[user.id,await hashOtp(code),expiresAt]);if(!config.emailFrom)throw new Error('AUTH_EMAIL_FROM must be configured');await ses.send(new SendEmailCommand({Source:config.emailFrom,Destination:{ToAddresses:[normalizedEmail]},Message:{Subject:{Charset:'UTF-8',Data:'Your 961 Media login code'},Body:{Text:{Charset:'UTF-8',Data:`Your 961 Media login code is ${code}. It expires in ${config.otpTtlMinutes} minutes. If you did not request this code, you can ignore this email.`},Html:{Charset:'UTF-8',Data:`<p>Your 961 Media login code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>It expires in ${config.otpTtlMinutes} minutes.</p><p>If you did not request this code, you can ignore this email.</p>`}}}}));return{expiresInSeconds:config.otpTtlMinutes*60};}
async function verifyOtp(email,code){const normalizedEmail=normalizeEmail(email);const normalizedCode=String(code||'').replace(/\s/g,'');if(!/^\d{6}$/.test(normalizedCode)){const e=new Error('Enter the 6-digit code');e.status=400;throw e;}const user=await getUserByEmail(normalizedEmail);if(!user||!user.is_active||user.role==='user'){const e=new Error('Invalid login code');e.status=401;throw e;}const config=await getAuthConfig();const result=await query('SELECT id,code_hash,expires_at,attempts FROM auth_otps WHERE user_id = $1 AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1',[user.id]);const otp=result&&result.rows[0];if(!otp||new Date(otp.expires_at).getTime()<Date.now()||otp.attempts>=config.maxOtpAttempts){const e=new Error('Invalid or expired login code');e.status=401;throw e;}const matches=timingSafeEqualHex(otp.code_hash,await hashOtp(normalizedCode));if(!matches){await query('UPDATE auth_otps SET attempts = attempts + 1 WHERE id = $1',[otp.id]);const e=new Error('Invalid or expired login code');e.status=401;throw e;}await query('UPDATE auth_otps SET consumed_at = NOW() WHERE id = $1',[otp.id]);await query('UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1',[user.id]);const token=jwt.sign({sub:user.id,id:user.id,email:user.email,role:user.role,displayName:user.display_name||undefined,authProvider:user.identity_provider},await getJwtSecret(),{expiresIn:config.sessionTtl,issuer:process.env.JWT_ISSUER||'961-media-cms',audience:process.env.JWT_AUDIENCE||'961-media-dashboard'});return{token,user:{id:user.id,email:user.email,role:user.role,displayName:user.display_name||null}};}
async function ensureConfiguredAdmins(){const raw=(await getAuthConfig()).adminEmails;const emails=String(raw||'').split(',').map(normalizeEmail).filter(validEmail);for(const email of emails){await query("INSERT INTO users (email,role,identity_provider) VALUES ($1,'admin','otp') ON CONFLICT (email) DO UPDATE SET role='admin',is_active=TRUE,updated_at=NOW()",[email]);}}
module.exports={requestOtp,verifyOtp,ensureConfiguredAdmins,normalizeEmail};
