SPForms
=======

A forms solution for SharePoint 2013 and 2010.
It is built in TypeScript (so it compiles to JavaScript). To use it, just download the compiled SPForms.js file.

Why do I need it?
-----------------
- You need a simple (or even complex) form to let users enter something and **store it within a SharePoint list**.
- You don't like the existing alternatives like
    - Default SharePoint New/Edit Forms
    - InfoPath (R.I.P)
    - waiting for Microsoft to make the successor of InfoPath available (on prem)

Requirements
------------
SPForms depends on the following libraries:

- [jQuery](http://jquery.com)
- [jQueryUI](http://jqueryui.com)
- [SPServices](http://spservices.codeplex.com)

Just get the required files
----------------------------
You only need the [SPForms.js](https://raw.githubusercontent.com/mwiedemeyer/SPForms/master/SPForms/SPForms.js) (or [SPForms.min.js](https://raw.githubusercontent.com/mwiedemeyer/SPForms/master/SPForms/SPForms.min.js)).


How does it work
----------------
It's super simple: Just create a standard HTML form and apply some attributes.
You can use whatever you want: HTML5 stuff, JavaScript frameworks, JavaScript libraries, etc.

Ok, here is an example of a basic form to write to a SharePoint list:
First add the JavaScript file (to your PageLayout, Masterpage or directly within a Content Editor Web Part):

    <script type="text/javascript" src="SPForms.js"></script>

If you want to use the people picker (in SP2013), add the following references to the existing SharePoint js files:

    <script src="/_layouts/15/clientforms.js"></script>
    <script src="/_layouts/15/clientpeoplepicker.js"></script>
    <script src="/_layouts/15/autofill.js"></script>

Second, create a form (for example directly within a Content Editor Web Part):

```HTML
    <div>
        <input type="text" name="Name" />
        <input type="text" name="EMail" />
        <input type="radio" name="AcceptLicense" id="radio1" value="Yes" />
        <label for="radio1">Yes</label>
        <input type="radio" name="AcceptLicense" id="radio2" value="No" />
        <label for="radio2">No</label>
        <label for="people1">Manager:</label>
        <input type="text" id="people1" />
        <input type="button" value="Save" />
    </div>
```

Now add the data- properties to it to make it a SharePoint list form:
(make sure, all input elements have a valid id attribute)

```HTML
    <div id="myspform" data-form-settings='{"maxParticipants": 5}'>
        <input id="name" type="text" name="Name" data-form-field="Title" data-form-required="true" data-form-validationmessage="This is a required field" data-form-profile="DisplayName" />
        <input id="email" type="text" name="EMail" data-form-field="EMail" data-form-required="true" data-form-validate="\w+([-+.']\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*" data-form-validationmessage="Not a valid email address" data-form-profile="EMail" />
        <input type="radio" name="AcceptLicense" id="radio1" value="Yes" data-form-field="LicenseAccepted" />
        <label for="radio1">Yes</label>
        <input type="radio" name="AcceptLicense" id="radio2" value="No" data-form-field="LicenseAccepted" />
        <label for="radio2">No</label>
        <label for="people1">Manager:</label>
        <input type="text" id="people1" data-form-peoplepicker="2013" data-form-field="Manager" data-form-peoplepicker-value="accountname" />
        <input type="button" value="Save" data-form-submit="true" data-form-submit-list="MyList" data-form-submit-onsuccess="onSubmitSuccess" data-form-submit-onfailed="onSubmitFailed"/>
    </div>
```

Now to the magic stuff, just add some JavaScript:

```HTML
    <script type="text/javascript">
        $(document).ready(function () {
            SPForms.FormManager.init("myspform");
        });

        function onSubmitSuccess() {
            alert("Success");
        }
        function onSubmitFailed(message) {
            alert("Error: " + message);
        }
    </script>

    <!-- The css class form-invalid is added to all form elements
        if they are not valid on submit -->
    <style type="text/css">
    .form-invalid
    {
        border: 1px solid red !important;
    }
</style>
```

You can even prepopulate fields by querystring.
Just add `form-` to the `data-form-field` names and append them to the URL.

    /myForm.aspx?form-title=the%20title


Available attributes
--------------------
Here are the available attributes:

        data-form-settings              Valid just once on the main forms div
        data-form-field                 Column name in the SharePoint list 
        data-form-required              true|false
        data-form-validate              RegEx to validate the value
        data-form-validationmessage     Message to display within the tooltip on validation/required errors
        data-form-peoplepicker          '2010' or '2013' to define an input box as a people picker
        data-form-peoplepicker-value    Used on the 2010 peoplepicker to define what is saved to the SP list as text (see details below).
                                        The 2013 picker always saves the selected user in a user field.
        data-form-datepicker            true to define a datepicker
        data-form-profile               A profile property of the current user to pre-populate the field with (see details below)
        data-form-submit                true to make this element the "submit" button
        data-form-submit-list           Title of the SP List to write to
        data-form-submit-onsuccess      Javascript function to execute after successful submit
        data-form-submit-onfailed       Javascript function to execute after failure

For the data-form-profile attribute, the following values are allowed:

    DisplayName
    FirstName
    LastName
    EMail
    Department
    Phone
    Title

For data-form-peoplepicker-value on the 2010 people picker, the following values are allowed:

    displayname
    accountname
    email