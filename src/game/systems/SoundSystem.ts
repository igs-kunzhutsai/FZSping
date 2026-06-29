export class SoundSystem {
    private static cache: Record<string, HTMLAudioElement> = {};
    private static initialized = false;
    private static lastPlayTime: Record<string, number> = {};
    private static orbitAudio: HTMLAudioElement | null = null;
    private static orbitFadeInterval: number | null = null;
    private static isOrbiting: boolean = false;

    static init() {
        if (this.initialized) return;
        this.initialized = true;

        const seFiles = import.meta.glob('/src/SE/*.{mp3,wav}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

        const sounds = [
            'SE-Dizzy1',
            'SE-Explo1',
            'SE-Heal1',
            'SE-Hurt1',
            'SE-Missle1',
            'SE-Sheild1',
            'SE-Warning1',
            'SE-Bay1',
            'SE-Bay2',
            'Attack_wave_017',
            'Shot_Beam_08',
            'SRW_Lock_01',
            'Attack_Punch_024',
            'Mech_Move_036',
            'Mech_Move_01',
            'Mech_Move_011',
            'Mech_Move_021',
            'pickupCoin_1',
            'Attack_Slash_020',
            'Attack_wave_032',
            'jump'
        ];

        sounds.forEach(name => {
            let ext = '.mp3';
            if (['SE-Dizzy1', 'SE-Explo1', 'SE-Heal1', 'SE-Hurt1', 'SE-Missle1', 'SRW_Lock_01', 'pickupCoin_1', 'jump'].includes(name)) {
                ext = '.wav';
            }
            const srcPath = `/src/SE/${name}${ext}`;
            const url = seFiles[srcPath];
            if (url) {
                this.cache[name] = new Audio(url);
                this.cache[name].load();
            } else {
                console.warn(`SoundSystem: Could not find imported URL for ${srcPath}`);
            }
        });
    }

    static play(name: string) {
        if (!this.initialized) {
            console.log('SoundSystem: Initializing on first play call.');
            this.init();
        }
        const now = Date.now();
        if (this.lastPlayTime[name] && now - this.lastPlayTime[name] < 80) return; // 80ms debounce
        this.lastPlayTime[name] = now;

        let baseName = name;
        if (name.includes('.')) {
            baseName = name.split('.')[0];
        }

        const audioTemp = this.cache[baseName];
        console.log(`SoundSystem.play requested: ${name}, found in cache: ${!!audioTemp}`);
        if (audioTemp) {
            // Create a new Audio instance from the original src to ensure playback works across browsers
            const clone = new Audio(audioTemp.src);
            
            if (baseName === 'Attack_wave_017') {
                clone.volume = 0.9;
            } else if (baseName === 'SRW_Lock_01') {
                clone.volume = 0.3;
            } else {
                clone.volume = 0.6;
            }
            
            if (baseName === 'SE-Bay2') {
                clone.playbackRate = 0.85 + Math.random() * 0.3; // 0.85 to 1.15
                if ('preservesPitch' in clone) {
                    (clone as any).preservesPitch = false;
                }
            } else if (baseName === 'Attack_wave_032') {
                clone.playbackRate = 1.5; // sped up by 50%
                if ('preservesPitch' in clone) {
                    (clone as any).preservesPitch = false;
                }
            }

            clone.play().catch(e => {
                console.warn(`SoundSystem: Failed to play ${name}:`, e);
            });
        }
    }

    static setOrbiting(orbiting: boolean) {
        if (!this.initialized) return;
        if (orbiting && !this.isOrbiting) {
            this.isOrbiting = true;
            if (!this.orbitAudio && this.cache['Mech_Move_036']) {
                this.orbitAudio = new Audio(this.cache['Mech_Move_036'].src);
                this.orbitAudio.loop = true;
                this.orbitAudio.playbackRate = 1.5;
            }
            if (this.orbitAudio) {
                if (this.orbitFadeInterval !== null) {
                    clearInterval(this.orbitFadeInterval);
                    this.orbitFadeInterval = null;
                }
                this.orbitAudio.volume = 0.6;
                this.orbitAudio.play().catch(e => {
                    console.warn('Orbit audio play prevented:', e);
                });
            }
        } else if (!orbiting && this.isOrbiting) {
            this.isOrbiting = false;
            if (this.orbitAudio) {
                if (this.orbitFadeInterval !== null) {
                    clearInterval(this.orbitFadeInterval);
                }
                this.orbitFadeInterval = window.setInterval(() => {
                    if (this.orbitAudio && this.orbitAudio.volume > 0.05) {
                        this.orbitAudio.volume = Math.max(0, this.orbitAudio.volume - 0.05);
                    } else {
                        if (this.orbitAudio) {
                            this.orbitAudio.pause();
                            this.orbitAudio.volume = 0; // reset
                        }
                        if (this.orbitFadeInterval !== null) {
                            clearInterval(this.orbitFadeInterval);
                            this.orbitFadeInterval = null;
                        }
                    }
                }, 50);
            }
        }
    }
}
