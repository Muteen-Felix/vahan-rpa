# Chrome Web Store listing

## Name

VAHAN RPA Assistant

## Summary

Fill VAHAN Public Report filters and export Excel after manual CAPTCHA completion.

## Detailed description

VAHAN RPA Assistant is an attended automation tool for the VAHAN Public Report page. It reads the filter choices currently provided by VAHAN, helps the user select and fill report filters, waits for the user to complete the CAPTCHA, and can initiate Excel export when report results become available.

Features:

- Dynamic State, RTO, vehicle, time-period, and report-axis options.
- Search and Select All for multi-value filters.
- Local storage of filter preferences.
- Manual CAPTCHA completion; the extension does not read, solve, store, or bypass CAPTCHA.
- Access limited to the VAHAN Public Report host.

This extension is not affiliated with, endorsed by, or an official product of MoRTH, NIC, Parivahan, or VAHAN.

## Category

Productivity

## Single purpose

Assist users in filling VAHAN Public Report filters and initiating Excel export after manual CAPTCHA completion.

## Permission justifications

- `storage`: Stores report-filter preferences locally in the user's Chrome profile.
- Host access to `analytics.parivahan.gov.in`: Reads dropdown options, fills the report form, retrieves dependent RTO/Maker options, and initiates the user-requested Excel export only on the VAHAN Public Report website.

## Data-use declaration

- Filter preferences are processed and stored locally.
- No data is sent to the developer or a developer-controlled server.
- CAPTCHA and authentication information are not collected or stored.
- No analytics, advertising, sale, or third-party sharing of user data.

## Required manual replacements

- Privacy Policy URL: [https://minhduc-it.github.io/vahan-rpa-privacy/](https://minhduc-it.github.io/vahan-rpa-privacy/)
- Support email: `minhduc081004@gmail`
- Support URL: [https://github.com/MinhDuc-IT/vahan-rpa-privacy/issues](https://github.com/MinhDuc-IT/vahan-rpa-privacy/issues)
- Homepage URL: `___`

