/// <reference path="Scripts/typings/jquery/jquery.d.ts" />
/// <reference path="Scripts/typings/jqueryui/jqueryui.d.ts" />
/// <reference path="Scripts/typings/sharepoint/SharePoint.d.ts" />

module SPForms {
    declare function commonShowModalDialog(a: any, b: any, c: any): void; //internal SharePoint function

    export class PeoplePicker2010 {

        public textBox: JQuery;
        constructor(textBoxId: string) {
            this.textBox = $("#" + textBoxId);
        }

        openPeoplePicker() {
            var dialogOptions = 'resizable:yes; status:no; scroll:no; help:no; center:yes; dialogWidth :575px; dialogHeight :500px;';
            var dialogURL = '/_layouts/picker.aspx';
            dialogURL += '?MultiSelect=False';
            dialogURL += '&CustomProperty=User,SecGroup,SPGroup;;15;;;False';
            dialogURL += '&EntitySeparator=;';
            dialogURL += '&DialogTitle=Select People and Groups';
            dialogURL += '&DialogImage=/_layouts/images/ppeople.gif';
            dialogURL += '&PickerDialogType=Microsoft.SharePoint.WebControls.PeoplePickerDialog, Microsoft.SharePoint, Version=12.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c';
            dialogURL += '&DefaultSearch=';

            commonShowModalDialog(dialogURL, dialogOptions, (sr) => { this.peoplePickerCallback(sr); });
        }

        private peoplePickerCallback(searchResult) {
            var xmlDoc = $.parseXML(searchResult);
            var $xml = $(xmlDoc);
            var account = $xml.find('Entity').attr('Key');
            var display = $xml.find('Entity').attr('DisplayText');
            var extraData = $xml.find('Entity ExtraData ArrayOfDictionaryEntry');
            var email = extraData.find('Key:contains("Email")').next().text();

            if (this.textBox.val() != null) {
                // multi select
                //if (this.textBox.val() != '') {
                //    var contactPerson = this.textBox.val();
                //    this.textBox.val(contactPerson + "; " + fqn);
                //}
                this.textBox.val(display);
                this.textBox.attr("data-people-display", display);
                this.textBox.attr("data-people-account", account);
                this.textBox.attr("data-people-email", email);
                this.textBox.focus();
            }

            return;
        }
    }
}
