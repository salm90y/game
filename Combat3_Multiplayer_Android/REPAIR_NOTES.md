# Combat 3 Android repair

Repairs applied to the supplied Final source:
- Added root `gradle.properties` with AndroidX enabled.
- Made native bridge loading lazy so the launcher does not crash when no PS1 core is installed.
- Corrected JNI audio callback signature (`onAudio([SII)V`).
- Corrected JNI symbol names to match the lazy bridge methods.
- Added a safe no-op frontend configuration JNI entry point.
- Kept ROM/BIOS and proprietary PS1 core binaries out of the project.

This source still requires a legally usable PS1 core and user-owned game/BIOS for actual gameplay. The source package cannot honestly claim two-device netplay verification without those runtime components and a deployed transport endpoint.
