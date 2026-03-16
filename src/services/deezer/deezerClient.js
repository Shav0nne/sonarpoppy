class DeezerClient {
    constructor() {
        this.baseUrl = "https://api.deezer.com";
    }

    async searchTrack(artist, title) {
        try {
            const query = `artist:"${artist}" track:"${title}"`;
            const url = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&limit=1`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Deezer API error: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.data && data.data.length > 0) {
                return data.data[0];
            }
            return null;
        } catch (error) {
            console.error("Error searching Deezer:", error.message);
            return null;
        }
    }
}

export default new DeezerClient();

