interface EmailTemplateOptions {
  header: string;
  buttonText: string;
  link: string;
  footerText: string;
}
export function baseEmailTemplate(options: EmailTemplateOptions) {
  const html =
    `<table width="600" align="center" style="margin: 0 auto; border-collapse: collapse;">
    <tr>
        <td>
            <div style="font-size: 16px; font-family: Arial, sans-serif; font-weight:normal; line-height:1.5em">
            ${options.header}
            </div>
        </td>
    </tr>
    <tr>
        <td>
            <!--Button-->
            <center>
                <table align="center" cellspacing="0" cellpadding="0" width="100%">
                    <tr>
                        <td align="center" style="padding: 10px;">
                            <table border="0" class="mobile-button" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td align="center" bgcolor="#fb923c" style="background-color: #fb923c; margin: auto; max-width: 600px; -webkit-border-radius: 5px; -moz-border-radius: 5px; border-radius: 5px;" width="100%">
                                        <!--[if mso]>&nbsp;<![endif]-->
                                        <a href="${options.link}" target="_blank" style="16px; font-family: Arial, sans-serif; color: #ffffff; font-weight:normal; text-align:center; background-color: #fb923c; text-decoration: none; border: none; padding: 15px 20px; -webkit-border-radius: 5px; -moz-border-radius: 5px; border-radius: 5px; display: inline-block;">
                                            <span style="font-size: 16px; font-family: Arial, sans-serif; color: #ffffff; font-weight:normal; line-height:1.5em; text-align:center;">${options.buttonText}</span>
                                        </a>
                                        <!--[if mso]>&nbsp;<![endif]-->
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </center>
        </td>
    </tr>
    <tr>
        <td>
            <div style="font-size: 16px; font-family: Arial, sans-serif; font-weight:normal; line-height:1.5em">
            ${options.footerText}
            <a href="${options.link}" target="_blank" style="color: #fb923c">${options.link}</a>
            </div>
        </td>
    </tr>
</table>`
  return html;
}
