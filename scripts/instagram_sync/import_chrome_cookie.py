import browser_cookie3
import instaloader
from pathlib import Path

def import_session():
    # Use the username you are currently logged in as on Chrome
    # We can try to just fetch the session automatically
    print("Fetching cookies from Chrome...")
    try:
        cj = browser_cookie3.chrome(domain_name="instagram.com")
    except Exception as e:
        print(f"Failed to fetch Chrome cookies: {e}")
        print("Make sure Chrome is closed, or allow Keychain access if prompted.")
        return

    # Look for the sessionid cookie
    sessionid = next((c.value for c in cj if c.name == 'sessionid'), None)
    if not sessionid:
        print("❌ Could not find 'sessionid' cookie in Chrome. Are you logged into Instagram?")
        return

    # Create an Instaloader instance
    loader = instaloader.Instaloader()
    
    # Send the cookies to Instaloader's requests session
    for cookie in cj:
        loader.context._session.cookies.set_cookie(cookie)
        
    # Test if login is valid by getting our own username
    try:
        # Instaloader needs a username to associate with the session.
        print("Cookies injected. Saving session...")
        
        cookie_file = Path(__file__).parent / "session.cookie"
        loader.save_session_to_file(str(cookie_file))
        print(f"\n✅ SUCCESS! Session cookie saved to {cookie_file}")
        print("You can now run 'make sync-healthcheck PROFILE=igormindra'")
        
    except Exception as e:
        print(f"❌ Failed to save session: {e}")

if __name__ == "__main__":
    import_session()
