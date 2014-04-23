/// <reference path="Scripts/typings/spservices/SPServices.d.ts" />
/// <reference path="Scripts/typings/jquery/jquery.d.ts" />
/// <reference path="Scripts/typings/jqueryui/jqueryui.d.ts" />
/// <reference path="Scripts/typings/sharepoint/SharePoint.d.ts" />
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
            var deferred = $.Deferred<IProfileData>();

            var userData: any = {};

            var params = {
                operation: 'GetUserProfileByName',
                async: true,
                completefunc: function (xData, Status) {
                    $(xData.responseXML).SPFilterNode("PropertyData").each(function () {
                        if ($(this).find("Name").text() === "PreferredName")
                            userData.displayName = $(this).find("Value").text();
                        if ($(this).find("Name").text() === "FirstName")
                            userData.firstName = $(this).find("Value").text();
                        if ($(this).find("Name").text() === "LastName")
                            userData.lastName = $(this).find("Value").text();
                        if ($(this).find("Name").text() === "WorkPhone")
                            userData.phone = $(this).find("Value").text();
                        if ($(this).find("Name").text() === "Department")
                            userData.department = $(this).find("Value").text();
                        if ($(this).find("Name").text() === "Title")
                            userData.title = $(this).find("Value").text();
                        if ($(this).find("Name").text() === "WorkEmail")
                            userData.email = $(this).find("Value").text();
                        if ($(this).find("Name").text() === "otg-Company")
                            userData.company = $(this).find("Value").text();
                    });

                    deferred.resolve(userData);
                },
                accountName: $().SPServices.SPGetCurrentUser({
                    fieldName: "Name"
                })
            };

            $().SPServices(params);

            return deferred.promise();
        }
    }
}