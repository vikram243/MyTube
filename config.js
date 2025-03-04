const passport = require('passport');
require('dotenv').config();

const GoogleStrategy = require('passport-google-oauth20').Strategy;
const Channel = require('@models/channel');
const { CreateUniqueHandle } = require('@lib/utils');

// Configure the Google strategy for use by Passport.
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
},
async (accessToken, refreshToken, profile, cb) => {
    try {
        let channel = await Channel.findOne({ email: profile.emails[0].value });

        if(!Channel) {
            const handle = await CreateUniqueHandle(profile.emails[0].value.split('@')[0]);
            channel = await Channel.create({
                name: profile.displayName,
                email: profile.emails[0].value,
                handle,
                logoURL: profile.photos[0].value.split('=')[0],
            });
        }

        return cb(null, channel);
    }
    catch(err){
        return cb(err);
    }
}
));

// Serialize the user to decide which data of the user object should be stored in the session.
passport.serializeUser((channel, done) => {
    done(null, channel.id);
});

// Deserialize the user to fetch the user object from the session.
passport.deserializeUser(async (id, done) => {
    try{
        const channel = await Channel.findById(id);
        done(null, channel);
    }
    catch(err){
        done(err);
    }
});

module.exports = passport;