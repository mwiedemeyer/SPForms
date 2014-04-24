/// <reference path="Scripts/typings/jquery/jquery.d.ts" />
/// <reference path="Scripts/typings/jqueryui/jqueryui.d.ts" />
/// <reference path="Scripts/typings/sharepoint/SharePoint.d.ts" />

module SPForms {

    export class PeoplePicker2013 {

        private divId: string;
        constructor(divId: string) {
            this.divId = divId;
        }

        public initAsync(): void {
            SP.SOD.loadMultiple(['sp.js', 'sp.runtime.js', 'sp.core.js', 'clienttemplates.js'], () => {
                // enable people picker
                var schema = {};
                schema['PrincipalAccountType'] = 'User,DL,SecGroup,SPGroup';
                schema['SearchPrincipalSource'] = 15;
                schema['ResolvePrincipalSource'] = 15;
                schema['AllowMultipleValues'] = false;
                schema['MaximumEntitySuggestions'] = 50;
                schema['Width'] = '280px';

                SPClientPeoplePicker.InitializeStandalonePeoplePicker(this.divId, null, schema);
            });
        }

        public getSelectedAccountName(): string {

            var pp = SPClientPeoplePicker.SPClientPeoplePickerDict[this.divId + "_TopSpan"];
            var accounts = pp.GetAllUserInfo();
            if (accounts.length == 0)
                return "";
            return accounts[0].Key;
        }
    }
}
