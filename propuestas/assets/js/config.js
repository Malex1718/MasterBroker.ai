// config.js
const authConfig = {
    twitter: {
        clientId: process.env.TWITTER_CLIENT_ID,
        redirectUri: `${window.location.origin}/auth/callback/twitter`,
        authEndpoint: 'https://twitter.com/i/oauth2/authorize',
        tokenEndpoint: 'https://api.twitter.com/2/oauth2/token',
        scope: 'tweet.read tweet.write users.read offline.access'
    },
    facebook: {
        clientId: process.env.FACEBOOK_CLIENT_ID,
        redirectUri: `${window.location.origin}/auth/callback/facebook`,
        authEndpoint: 'https://www.facebook.com/v18.0/dialog/oauth',
        tokenEndpoint: 'https://graph.facebook.com/v18.0/oauth/access_token',
        scope: 'pages_show_list,pages_read_engagement,pages_manage_posts'
    },
    instagram: {
        direct: {
            clientId: process.env.INSTAGRAM_CLIENT_ID,
            redirectUri: `${window.location.origin}/auth/callback/instagram`,
            authEndpoint: 'https://api.instagram.com/oauth/authorize',
            tokenEndpoint: 'https://api.instagram.com/oauth/access_token',
            scope: [
                'instagram_business_basic',
                'instagram_business_content_publish',
                'instagram_business_manage_messages',
                'instagram_business_manage_comments'
            ].join(' ')
        },
        facebook: {
            clientId: process.env.FACEBOOK_CLIENT_ID,
            redirectUri: `${window.location.origin}/auth/callback/instagram/facebook`,
            authEndpoint: 'https://www.facebook.com/v18.0/dialog/oauth',
            tokenEndpoint: 'https://graph.facebook.com/v18.0/oauth/access_token',
            scope: [
                'instagram_basic',
                'instagram_content_publish',
                'instagram_manage_comments',
                'instagram_manage_messages',
                'pages_show_list'
            ].join(' ')
        }
    }
};

export default authConfig;