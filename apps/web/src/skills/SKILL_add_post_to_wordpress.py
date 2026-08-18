import requests
import time
from requests.auth import HTTPBasicAuth
import mimetypes

def get_category_id(category_name: str, WP_URL, auth, headers) -> int:
    """
    Retrieves the ID of a category by name. If the category doesn't exist, it creates one.
    """
    response = requests.get(f"{WP_URL}/categories", auth=auth, headers=headers)
    response.raise_for_status()
    categories = response.json()

    # Search for the category by name
    for category in categories:
        if category['name'].lower() == category_name.lower():
            return category['id']

    # If not found, create the category
    new_category = {
        'name': category_name
    }
    response = requests.post(f"{WP_URL}/categories", auth=auth, headers=headers, json=new_category)
    response.raise_for_status()
    return response.json()['id']

def upload_image(image_path: str, WP_URL, auth) -> int:
    """
    Uploads an image to WordPress and returns the attachment ID.
    """
    mime_type, _ = mimetypes.guess_type(image_path)
    if mime_type is None:
        mime_type = 'application/octet-stream'  # Default if MIME type can't be guessed

    with open(image_path, 'rb') as img:
        filename = image_path.split('/')[-1]
        media_headers = {
            'Content-Disposition': f'attachment; filename="{filename}"',
            'Content-Type': mime_type,
            'Accept': 'application/json'
        }
        response = requests.post(f"{WP_URL}/media", auth=auth, headers=media_headers, data=img)
        response.raise_for_status()
        media = response.json()
        return media['id']

def post_article(title: str, content: str, category_name: str, image_path: str, WP_URL, auth, headers) -> str:
    """
    Creates and publishes a new post on WordPress with the specified category and optional featured image.
    """
    category_id = get_category_id(category_name, WP_URL, auth, headers)

    post_data = {
        'title': title,
        'content': content,
        'status': 'publish',  # Use 'draft' if you don't want to publish immediately
        'categories': [category_id]
    }

    if image_path:
        media_id = upload_image(image_path, WP_URL, auth)
        post_data['featured_media'] = media_id

    response = requests.post(f"{WP_URL}/posts", auth=auth, headers=headers, json=post_data)
    response.raise_for_status()
    post = response.json()

    return f"Post '{title}' created successfully with ID {post['id']}."

def add_post_to_wordpress(WP_URL, USERNAME, PASSWORD, article_title, article_content, article_category, image_path=None):
    """
    Main function to create a post with optional featured image on WordPress.
    """
    # Create an authenticated session
    auth = HTTPBasicAuth(USERNAME, PASSWORD)
    headers = {
        'Content-Type': 'application/json'
    }

    try:
        result = post_article(article_title, article_content, article_category, image_path, WP_URL, auth, headers)
        print(result)
    except requests.exceptions.RequestException as e:
        print(f"An error occurred: {e}")

# Example usage
if __name__ == "__main__":
    WP_URL = 'https://www.example.com/wp-json/wp/v2'  # Replace with your WordPress site URL
    USERNAME = 'your_username'  # Replace with your WordPress username
    PASSWORD = 'your_application_password'  # Replace with your WordPress application password
    article_title = "My First Post"
    article_content = "This is the content of my first post."
    article_category = "Announcements"
    image_path = 'path/to/your/image.jpg'  # Replace with the actual image path

    add_post_to_wordpress(WP_URL, USERNAME, PASSWORD, article_title, article_content, article_category, image_path)