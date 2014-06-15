module SPForms.Profile {

    export class ProfileManager2013 {
        static getProfileAsync(): JQueryPromise<IProfileData> {
            var deferred = $.Deferred<IProfileData>();

            var userData: any = {};


            SP.SOD.loadMultiple(['sp.js', 'userprofile'], () => {
                var context = SP.ClientContext.get_current();
                var peopleManager = new SP.UserProfiles.PeopleManager(context);

                var currentUser = context.get_web().get_currentUser();
                context.load(currentUser);
                context.executeQueryAsync(() => {

                    var targetUser = currentUser.get_loginName();
                    var profilePropertyNames = ["PreferredName", "FirstName", "LastName", "WorkPhone", "Department", "Title", "WorkEmail"];
                    var userProfilePropertiesForUser = new SP.UserProfiles.UserProfilePropertiesForUser(context, targetUser, profilePropertyNames);

                    var properties = peopleManager.getUserProfilePropertiesFor(userProfilePropertiesForUser);
                    context.load(userProfilePropertiesForUser);
                    context.executeQueryAsync((sender, args) => {


                        userData.displayName = properties[0];
                        userData.firstName = properties[1];
                        userData.lastName = properties[2];
                        userData.phone = properties[3];
                        userData.department = properties[4];
                        userData.title = properties[5];
                        userData.email = properties[6];

                        deferred.resolve(userData);

                    }, (sender, args) => {
                        });
                }, () => {
                    });
            });

            return deferred.promise();
        }
    }
}