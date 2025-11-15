# Deployment Guide

## ✅ What's Been Completed

1. ✅ Next.js 15 application scaffolded
2. ✅ All API routes implemented (ElevenLabs, OpenAI, Supabase)
3. ✅ React components with Lithuanian UI
4. ✅ TypeScript types defined
5. ✅ Git repository initialized
6. ✅ Code pushed to GitHub: https://github.com/rokas2025/Playvoicetech2025

## 📋 Next Steps

### Step 1: Setup Supabase Database

1. Go to your Supabase project: https://supabase.com/dashboard/project/wcecsvujnooyrkkcqutj
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open `supabase_schema.sql` in this project
5. Copy all the SQL and paste into the Supabase SQL editor
6. Click **Run** (or press Ctrl+Enter)
7. Verify: Run `SELECT * FROM agents;` - you should see one default agent

### Step 2: Deploy to Vercel

#### Option A: Manual Connection (Recommended)

1. Go to https://vercel.com/new
2. Click **Import Git Repository**
3. Select: `rokas2025/Playvoicetech2025`
4. Click **Import**
5. **Add Environment Variables** (click "Environment Variables" section):

```
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Note**: Use the actual values from your `.env.local` file.

6. Click **Deploy**
7. Wait for deployment to complete (~2-3 minutes)
8. Click on the deployment URL to test!

#### Option B: Using Vercel CLI

```bash
# Install Vercel CLI globally
npm i -g vercel

# Set token
$env:VERCEL_TOKEN="9ZFidcTehA6x1eSV2jw9IhFJ"

# Deploy
vercel --token=$env:VERCEL_TOKEN --yes
```

### Step 3: Test the Application

1. Open the Vercel deployment URL
2. You should see the Lithuanian voice assistant dashboard
3. **First, go to Settings (right panel)**:
   - Select an agent (default: "Pagrindinis asistentas")
   - **Select a voice** from the dropdown (this is required!)
   - Adjust voice settings if desired
   - Click "Išsaugoti nustatymus"
4. **Now test the voice flow**:
   - Click "Pradėti kalbėti"
   - Allow microphone access when prompted
   - Speak in Lithuanian
   - Click "Sustabdyti"
   - Wait for the assistant to respond (you'll see status: "Mąstau..." then "Kalbu...")
   - The assistant will speak back to you!

### Step 4: Monitor Deployment

If there are any errors:

```bash
# Fetch deployment logs
vercel logs --token=$env:VERCEL_TOKEN
```

Or check the Vercel dashboard: https://vercel.com/dashboard

## 🐛 Troubleshooting

### Build Errors

- Check Vercel build logs in the dashboard
- Ensure all environment variables are set correctly
- Verify Node.js version (should be 18+)

### Runtime Errors

**"Nepavyko gauti balsų sąrašo"**
- Check ELEVENLABS_API_KEY is correct
- Verify API key has access to voices

**"Agentas nerastas"**
- Make sure you ran the Supabase SQL schema
- Check SUPABASE_URL and keys are correct

**"Nepavyko atpažinti kalbos"**
- Ensure microphone permissions are granted
- Speak clearly in Lithuanian
- Check browser console for errors

**No voice selected warning**
- Go to Settings panel
- Select a voice from the dropdown
- Click "Išsaugoti nustatymus"

## 📊 Monitoring

### Check Deployment Status
```bash
vercel ls --token=$env:VERCEL_TOKEN
```

### View Logs
```bash
vercel logs [deployment-url] --token=$env:VERCEL_TOKEN
```

### Redeploy
Just push to GitHub:
```bash
git add .
git commit -m "Your changes"
git push
```

Vercel will automatically redeploy!

## 🎉 Success Criteria

- ✅ Application loads without errors
- ✅ Can select agent and voice in settings
- ✅ Can record audio (microphone access granted)
- ✅ Speech is transcribed to Lithuanian text
- ✅ LLM generates Lithuanian response
- ✅ TTS plays back the response
- ✅ Messages are saved to Supabase
- ✅ Conversation history persists

## 📞 Support

If you encounter issues:
1. Check the browser console (F12)
2. Check Vercel deployment logs
3. Verify all API keys are correct
4. Ensure Supabase schema is created

## 🚀 Future Enhancements

After successful deployment, consider:
- [ ] Upgrade to WebSocket realtime STT
- [ ] Add streaming LLM responses
- [ ] Implement user authentication
- [ ] Add conversation analytics
- [ ] SIP integration for phone calls

