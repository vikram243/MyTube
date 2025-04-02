const passport = require('passport');
require('dotenv').config();

const GoogleStrategy = require('passport-google-oauth20').Strategy;
const Channel = require('@models/channel');
const { createUniqueHandle } = require('@lib/utils');

// Configure the Google strategy for Passport
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL
        },
        async (accessToken, refreshToken, profile, cb) => {
            try {
                const email = profile.emails[0].value;
                let channel = await Channel.findOne({ email });

                if (!channel) {
                    const handle = await createUniqueHandle(email.split('@')[0]);
                    channel = await Channel.create({
                        name: profile.displayName,
                        email,
                        handle,
                        logoURL: profile.photos[0]?.value.split('=')[0] || '',
                    });
                }

                cb(null, channel);
            } catch (err) {
                cb(err);
            }
        }
    )
);

// Serialize user session
passport.serializeUser((channel, done) => done(null, channel.id));

// Deserialize user session
passport.deserializeUser(async (id, done) => {
    try {
        const channel = await Channel.findById(id);
        done(null, channel);
    } catch (err) {
        done(err);
    }
});

module.exports = passport;
