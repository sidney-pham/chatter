// Fill this in and rename the file to whatever you want, I guess.
// I called it socialConfig.js.

if (Meteor.isServer) {
    ServiceConfiguration.configurations.remove({
        service: 'facebook'
    });

    ServiceConfiguration.configurations.insert({
        service: 'facebook',
        appId: 'yup, right here.',
        secret: 'here too...'
    });
}