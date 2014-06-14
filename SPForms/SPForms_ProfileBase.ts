module SPForms.Profile {

    export interface IProfileData {
        displayName: string;
        firstName: string;
        lastName: string;
        phone: string;
        department: string;
        title: string;
        email: string;
        company: string;
    }

    export class ProfileManager {
        static getProfileAsync(): JQueryPromise<IProfileData> {
            if (Helper.getSPVersion() === 2013) {
                return ProfileManager2013.getProfileAsync();
            }
            else {
                return ProfileManager2010.getProfileAsync();
            }
        }
    }
}