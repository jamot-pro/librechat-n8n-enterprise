# LinkedIn Comments & Engagement - Optional Setup

## Overview

LinkedIn requires the **Community Management API** to be on a **separate app** from your posting app. This is a LinkedIn security requirement.

**Current Status**:
- ✅ Posting works with your main app
- ⏳ Comments/replies require a second app

**When to set this up**:
- When users actively request comment/reply features
- When you have validated posting functionality
- When you're ready to manage two LinkedIn apps

---

## Execution Plan (Keys Already Ready)

Since posting is already working in production for your main app, this is the fastest safe path to add:
- View comments on a post
- Create a comment on a post
- Reply to a comment

### Phase 0 - Configuration (30-45 minutes)

1. Add the comments-app credentials to `.env`:

```env
# Main app (existing - posting)
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
LINKEDIN_REDIRECT_URI=http://localhost:3080/api/linkedin/callback

# New comments app (Community Management)
LINKEDIN_COMMENTS_CLIENT_ID=...
LINKEDIN_COMMENTS_CLIENT_SECRET=...
LINKEDIN_COMMENTS_REDIRECT_URI=http://localhost:3080/api/linkedin/comments/callback
```

2. Ensure redirect URI in LinkedIn comments app matches exactly:
   - `http://localhost:3080/api/linkedin/comments/callback`
   - Production equivalent for your deployed domain.

3. Confirm comments app scopes/products are active in LinkedIn portal.

### Phase 1 - Backend Dual-App Support (1 day)

Goal: keep posting on the current app, and use the new app only for comments/replies.

1. **Data model updates**
   - Store comments-app tokens separately from posting tokens.
   - Recommended: extend `SocialAccount.metadata` with a second token set (or create a second `platform` record like `linkedin_comments`).
   - Persist:
     - comments access token
     - comments refresh token
     - comments token expiry
     - comments auth status flag

2. **OAuth routes for comments app**
   - Add dedicated connect/callback routes:
     - `GET /api/linkedin/comments/connect`
     - `GET /api/linkedin/comments/callback`
   - Use `LINKEDIN_COMMENTS_*` credentials only in these routes.
   - Keep existing posting OAuth routes unchanged.

3. **Service split**
   - In `LinkedInService`, separate token retrieval/refresh paths:
     - posting token methods (existing)
     - comments token methods (new)
   - Comments/replies/read endpoints must enforce comments token availability.

4. **Comments endpoints validation**
   - `POST /api/linkedin/comments`
   - `POST /api/linkedin/comments/:commentUrn/reply`
   - `GET /api/linkedin/comments/:postUrn`
   - Return explicit errors:
     - `COMMENTS_NOT_CONNECTED`
     - `COMMENTS_TOKEN_EXPIRED_RECONNECT_REQUIRED`
     - `INSUFFICIENT_LINKEDIN_SCOPE`

### Phase 2 - Frontend UX (0.5-1 day)

1. In `LinkedInAccountSettings.tsx` add a second status block:
   - **Posting Access**: Connected/Not Connected (existing)
   - **Comments Access**: Connected/Not Connected (new)

2. Add buttons:
   - `Connect Comments Access`
   - `Reconnect Comments Access`
   - Optional: `Disconnect Comments Access`

3. Add endpoint calls in UI:
   - `GET /api/linkedin/comments/status` (new)
   - `GET /api/linkedin/comments/connect`
   - optional `DELETE /api/linkedin/comments/disconnect`

4. In comment/reply entry points (wherever used), show actionable errors:
   - "Comments access is not connected. Connect it in Settings."

### Phase 3 - Post/Comment Linking (0.5 day)

To comment/reply reliably, keep `postUrn` from published posts.

1. Ensure `POST /api/linkedin/posts` response includes stable `urn`.
2. Persist `urn` in your post/draft record if not already stored.
3. Pass that `postUrn` to comment/reply endpoints.

### Phase 4 - Test Matrix (same day)

Run in this order:

1. **OAuth tests**
   - Main posting OAuth still works.
   - Comments OAuth works independently.
   - Reconnecting comments does not break posting.

2. **Comment flow tests**
   - Read comments for known `postUrn`.
   - Add comment.
   - Reply to existing comment.
   - Verify visibility on LinkedIn UI.

3. **Failure tests**
   - Comments not connected -> clear error.
   - Expired comments token -> refresh or reconnect flow.
   - Invalid `postUrn` -> controlled 4xx response.

4. **Multi-user isolation**
   - User A cannot read/comment with User B tokens.

### Phase 5 - Rollout (same day)

1. Deploy with comments feature flag (recommended).
2. Enable for internal users first.
3. Monitor logs for:
   - OAuth callback errors
   - LinkedIn 401/403 rate
   - token refresh failures
4. Then enable for all users.

### Definition of Done

- Users can connect comments access from Settings.
- Users can read comments from a LinkedIn post.
- Users can comment on a post.
- Users can reply to a comment.
- Posting flow remains unaffected.

---

## Why Two Apps?

LinkedIn's reasoning:
1. **Security**: Comments API has more sensitive permissions
2. **Legal**: Different terms of service and compliance requirements
3. **Isolation**: Separates posting from engagement features

This is a LinkedIn requirement, not a limitation of our implementation.

---

## Option 1: Skip Comments for Now (Recommended)

### What Works Without Comments API
- ✅ Create posts on LinkedIn
- ✅ OAuth authentication
- ✅ Per-user accounts
- ✅ Token management
- ✅ All core posting features

### What Doesn't Work
- ❌ Post comments on LinkedIn posts
- ❌ Reply to comments
- ❌ View comments programmatically

### Why This is OK
- Most users primarily need posting
- You can validate product-market fit with posting alone
- Comments can be added later without disrupting existing users
- Reduces initial complexity

**Recommendation**: Start here. Add comments when users request it.

---

## Option 2: Add Comments Now (Advanced)

If you need comments/replies immediately, follow these steps:

### Step 1: Create Second LinkedIn App (10 minutes)

1. **Go to LinkedIn Developers**
   - Visit: https://www.linkedin.com/developers/apps
   - Click **"Create app"**

2. **Fill in App Details**
   - **App name**: `LibreChat Social Integration - Comments`
   - **LinkedIn Page**: Same company page as main app
   - **App logo**: Same logo (optional)
   - **Legal agreement**: Check the box

3. **Create the App**
   - Click **"Create app"**
   - You now have a second app!

### Step 2: Configure Second App (5 minutes)

1. **Add Redirect URLs**
   - Go to **"Auth"** tab
   - Under **"Redirect URLs"**, add:
     - `http://localhost:3090/api/linkedin/comments/callback`
     - `https://app.jamot.pro/api/linkedin/comments/callback`
   - Click **"Update"**

2. **Request Community Management API**
   - Go to **"Products"** tab
   - Find **"Community Management API"**
   - Click **"Request access"**
   - Fill in the form:
     - **Use case**: "User-generated content management and engagement"
     - **Description**: "Allow users to comment and engage on LinkedIn posts through our platform"
   - Submit

3. **Wait for Approval**
   - Usually takes 1-2 business days
   - Check email for approval notification
   - Check app dashboard for status

### Step 3: Get Credentials (2 minutes)

1. **Copy Client ID**
   - In your second app dashboard
   - Copy the Client ID

2. **Copy Client Secret**
   - Click **"Show"** next to Client Secret
   - Copy the secret

### Step 4: Update Environment Variables (3 minutes)

Add to your `.env` file:

```env
# Main app (posting)
LINKEDIN_CLIENT_ID=your_main_app_client_id
LINKEDIN_CLIENT_SECRET=your_main_app_client_secret
LINKEDIN_REDIRECT_URI=http://localhost:3090/api/linkedin/callback

# Second app (comments) - OPTIONAL
LINKEDIN_COMMENTS_CLIENT_ID=your_comments_app_client_id
LINKEDIN_COMMENTS_CLIENT_SECRET=your_comments_app_client_secret
LINKEDIN_COMMENTS_REDIRECT_URI=http://localhost:3090/api/linkedin/comments/callback
```

### Step 5: Update Code (15 minutes)

**Option A: Simple Approach (Use Second App for Everything)**

Update `.env` to use the comments app credentials:
```env
# Use comments app for all features
LINKEDIN_CLIENT_ID=your_comments_app_client_id
LINKEDIN_CLIENT_SECRET=your_comments_app_client_secret
```

**Pros**: Simple, one set of credentials
**Cons**: Lose separation of concerns

**Option B: Advanced Approach (Two Apps)**

Keep both apps and use them for different purposes:
- Main app: Posting only
- Comments app: Comments and replies

This requires code changes to support two OAuth flows. Contact us if you need this.

### Step 6: Test Comments (5 minutes)

Once approved:

1. **Reconnect LinkedIn**
   - Disconnect current connection
   - Connect again (to get new permissions)

2. **Test Comment**
   ```bash
   curl -X POST http://localhost:3090/api/linkedin/comments \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "postUrn": "urn:li:share:1234567890",
       "comment": "Great post! 👍"
     }'
   ```

3. **Verify on LinkedIn**
   - Check the post on LinkedIn
   - Your comment should appear

---

## Comparison: One App vs Two Apps

### One App (Posting Only)
**Pros**:
- ✅ Simpler setup
- ✅ One set of credentials
- ✅ Easier to manage
- ✅ Faster to implement

**Cons**:
- ❌ No comments/replies
- ❌ Limited engagement features

**Best for**:
- Initial launch
- MVP testing
- Posting-focused use case

### Two Apps (Posting + Comments)
**Pros**:
- ✅ Full feature set
- ✅ Comments and replies
- ✅ Complete engagement
- ✅ Follows LinkedIn best practices

**Cons**:
- ❌ More complex setup
- ❌ Two apps to manage
- ❌ Approval wait time

**Best for**:
- Production deployment
- Engagement-focused use case
- After validating posting works

---

## Migration Path

### Phase 1: Posting Only (Current)
```
Main App → Posting ✅
Comments → Not available ⏸️
```

### Phase 2: Add Comments (When Needed)
```
Main App → Posting ✅
Second App → Comments ✅
```

### Phase 3: Consolidate (Optional)
```
Comments App → Everything ✅
Main App → Deprecated
```

---

## FAQ

**Q: Can I use one app for both posting and comments?**
A: No, LinkedIn requires Community Management API to be on a separate app.

**Q: Will my existing users need to reconnect?**
A: Yes, when you add comments, users will need to reconnect to grant new permissions.

**Q: Can I switch from main app to comments app later?**
A: Yes, but users will need to reconnect. Plan this during a maintenance window.

**Q: Do I need to pay for two apps?**
A: No! Both apps are free. LinkedIn doesn't charge for developer apps.

**Q: Which app should I use for production?**
A: Start with main app (posting). Add second app when users request comments.

**Q: Can I delete the main app after creating comments app?**
A: Yes, but all users will need to reconnect. Better to keep both.

---

## Troubleshooting

### Issue: "Community Management API request denied"
**Possible reasons**:
- App doesn't meet LinkedIn's requirements
- Use case not clear enough
- Company page not verified

**Solution**:
1. Ensure company page is complete and verified
2. Provide detailed use case description
3. Explain how you'll use the API responsibly
4. Reapply with more details

### Issue: "Users can't comment after connecting"
**Check**:
- [ ] Community Management API is approved
- [ ] Using correct app credentials
- [ ] User reconnected after API approval
- [ ] Correct scopes requested

### Issue: "Comments work but posting doesn't"
**This means**:
- You're using comments app for everything
- Comments app doesn't have "Share on LinkedIn" product

**Solution**:
- Add "Share on LinkedIn" to comments app
- Or use main app for posting, comments app for comments

---

## Recommendation

### For Most Users
**Start with posting only** (main app):
1. Simpler setup
2. Faster to market
3. Validate product-market fit
4. Add comments later when needed

### For Power Users
**Add comments from day one** (two apps):
1. If engagement is core to your product
2. If users explicitly need comments
3. If you have time for complex setup
4. If you're comfortable managing two apps

---

## Summary

| Aspect | Posting Only | Posting + Comments |
|--------|--------------|-------------------|
| Setup Time | 30 minutes | 1 hour + approval wait |
| Complexity | Low | Medium |
| Apps Needed | 1 | 2 |
| Features | Posting | Posting + Comments |
| Cost | $0 | $0 |
| Approval Wait | None | 1-2 days |
| Recommended For | MVP, Initial Launch | Production, Full Features |

---

**Current Recommendation**: Start with posting only. Add comments when users request it.

**Last Updated**: March 10, 2026  
**Status**: Optional Enhancement  
**Priority**: Low (unless users request it)
