// This service handles Google Drive API interactions.
// It requires GOOGLE_CLIENT_ID and GOOGLE_API_KEY to be set.

declare global {
  interface Window {
    gapi: any;
    google: any;
    tokenClient: any;
  }
}

export interface UserProfile {
  name: string;
  email: string;
  picture: string;
}

export interface DriveFile {
  id: string;
  name: string;
}

const CLIENT_ID = "261868305634-616kf28bgh14e8g7qu62c24lfnmotd2r.apps.googleusercontent.com";
// NOTE: You still need to provide a Google API Key for the file picker to work.
const API_KEY = "YOUR_GOOGLE_API_KEY_HERE";
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

class GoogleDriveService {
  private gapiReady = false;
  private gisReady = false;
  private token: any = null;
  private profile: UserProfile | null = null;
  private listeners: (() => void)[] = [];

  constructor() {
    if (CLIENT_ID.startsWith("YOUR_")) {
        console.warn("Google Client ID is not set. The Data Sources feature will not work.");
        return; // Can't do anything without client ID.
    }
    if (API_KEY.startsWith("YOUR_")) {
        console.warn("Google API Key is not set. File picker functionality will be disabled.");
    }

    this.loadGapi();
    this.loadGis();
  }
  
  subscribe(callback: () => void) {
    this.listeners.push(callback);
  }

  unsubscribe(callback: () => void) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  private notifyListeners() {
    this.listeners.forEach(l => l());
  }
  
  private loadGapi() {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => window.gapi.load('client:picker', () => { this.gapiReady = true; });
    document.body.appendChild(script);
  }

  private loadGis() {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse: any) => this.handleTokenResponse(tokenResponse),
      });
      this.gisReady = true;
    };
    document.body.appendChild(script);
  }
  
  private async handleTokenResponse(tokenResponse: any) {
     this.token = tokenResponse;
      try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { 'Authorization': `Bearer ${this.token.access_token}` }
        });
        const profileData = await response.json();
        this.profile = {
          name: profileData.name,
          email: profileData.email,
          picture: profileData.picture
        };
        this.notifyListeners();
      } catch (error) {
        console.error("Failed to fetch user profile:", error);
        this.signOut();
      }
  }

  async signIn() {
    if (!this.gisReady) {
      console.error("Google Identity Services not ready.");
      return;
    }
    window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse: any) => this.handleTokenResponse(tokenResponse),
      }).requestAccessToken();
  }

  signOut() {
    if (this.token && window.google?.accounts?.oauth2) {
        window.google.accounts.oauth2.revoke(this.token.access_token, () => {});
    }
    this.token = null;
    this.profile = null;
    this.notifyListeners();
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }
  
  getProfile(): UserProfile | null {
      return this.profile;
  }

  showPicker(): Promise<DriveFile | null> {
    return new Promise(async (resolve, reject) => {
        if (API_KEY.startsWith("YOUR_")) {
          const errorMsg = "Google API Key is not configured. Cannot show file picker.";
          console.error(errorMsg);
          // You might want to show an alert to the user here.
          return reject(errorMsg);
        }

        if (!this.isAuthenticated()) {
            await this.signIn();
            // Need a slight delay to ensure the token is processed before picker opens
            await new Promise(res => setTimeout(res, 1000));
            if (!this.isAuthenticated()) {
                return reject("Authentication failed.");
            }
        }

      if (!this.gapiReady || !this.token) {
        return reject("GAPI not ready or user not authenticated.");
      }

      const view = new window.google.picker.View(window.google.picker.ViewId.DOCS);
      const picker = new window.google.picker.PickerBuilder()
        .setApiKey(API_KEY)
        .setAppId(CLIENT_ID.split('-')[0])
        .setOAuthToken(this.token.access_token)
        .addView(view)
        .setCallback((data: any) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const doc = data.docs[0];
            resolve({ id: doc.id, name: doc.name });
          } else if (data.action === window.google.picker.Action.CANCEL) {
            resolve(null);
          }
        })
        .build();
      picker.setVisible(true);
    });
  }

  async getFileContent(fileId: string): Promise<string> {
    if (!this.isAuthenticated()) {
      throw new Error("User not authenticated.");
    }
    await window.gapi.client.load(DISCOVERY_DOC);
    const response = await window.gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media'
    });
    
    if (typeof response.body === 'string') {
        return response.body;
    }
    
    // For binary files, this part would need more sophisticated handling.
    // For now, we'll assume text-based content.
    return "Could not decode file content.";
  }
}

export const googleDriveService = new GoogleDriveService();