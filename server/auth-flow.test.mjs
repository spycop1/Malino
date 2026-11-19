import test from 'node:test';
import assert from 'node:assert/strict';
import {readAuthReturn} from '../public/auth-flow.js';

test('normaler MALINO-Aufruf ist keine E-Mail-Rückleitung',()=>{
  assert.deepEqual(readAuthReturn('https://spycop1.github.io/Malino/'),{fromEmail:false,error:false,expired:false});
});
test('erfolgreiche Supabase-URL mit Tokenfragment wird erkannt, ohne Token herauszugeben',()=>{
  assert.deepEqual(readAuthReturn('https://spycop1.github.io/Malino/#access_token=secret-token&refresh_token=secret'),{fromEmail:true,error:false,expired:false});
});
test('abgelaufener oder wiederverwendeter Magic Link wird erkannt',()=>{
  assert.deepEqual(readAuthReturn('https://spycop1.github.io/Malino/?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'),{fromEmail:true,error:true,expired:true});
});
test('ein OAuth-/PKCE-Code wird als Rückleitung erkannt',()=>{
  assert.deepEqual(readAuthReturn('https://spycop1.github.io/Malino/?code=temporary'),{fromEmail:true,error:false,expired:false});
});
