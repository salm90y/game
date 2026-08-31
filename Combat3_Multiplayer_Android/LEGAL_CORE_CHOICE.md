# Legal core choice for this build

The project is prepared to use **Beetle PSX / Beetle PSX HW**, whose Libretro core is GPLv2 according to the Libretro documentation.

That is preferable to bundling the DuckStation Libretro core because the DuckStation Libretro core has a non-commercial restriction.

For GPLv2 compliance when distributing a build containing Beetle PSX:
- include the applicable GPLv2 license text;
- provide the corresponding source code / source offer as required by GPLv2;
- preserve copyright and license notices;
- do not include Sony copyrighted BIOS or game images.

The user can supply their own game image and, where desired, their own BIOS. Beetle PSX documentation also documents OpenBIOS support.

The app's frontend implementation uses the Libretro API, which Libretro documents as MIT-licensed.
