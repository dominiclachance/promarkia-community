from openai import OpenAI
from typing import List
import uuid
import requests
from pathlib import Path
import os

def generate_and_save_images(query: str, image_size: str = "1792x1024", quality: str = "standard") -> List[str]:
    """
    Function to generate images using OpenAI's DALLE 3 API (new API structure).
    """
    # Fetch the OpenAI API key from the runtime environment.
    openai_api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not openai_api_key:
        raise ValueError("OpenAI API key not found in environment variables.")
    
    # Initialize the OpenAI client with the API key
    client = OpenAI(api_key=openai_api_key)

    try:
        # Generate the image(s) using DALLE 3
        response = client.images.generate(
            model="dall-e-3",
            prompt=query,
            size=image_size,
            quality=quality,
            n=1,  # Number of images to generate
        )
        
        # Debugging: Log the entire response
        print("API Response:", response)
        
    except Exception as e:
        print(f"Error generating image: {e}")
        return []

    # List to store the URLs of saved images
    saved_files = []

    # Check if the response contains image data
    if response.data and len(response.data) > 0:
        for image_data in response.data:
            try:
                # Generate a random UUID for the image file name
                file_name = str(uuid.uuid4()) + ".png"
                file_path = Path(file_name)

                # Download the image from the provided URL
                img_url = image_data.url  # Accessing the image URL correctly
                img_response = requests.get(img_url)

                # Check if the download was successful
                if img_response.status_code == 200:
                    # Save the image to a file
                    with open(file_path, "wb") as img_file:
                        img_file.write(img_response.content)

                    # Generate the relative path to where the file is saved
                    relative_path = os.path.relpath(file_path, "/home/ubuntu/.autogenstudio")
                    print(f"Image saved to https://api.wisdomprompt.com/api/{relative_path}")

                    # Append the file's URL to the list of saved files
                    saved_files.append(f"https://api.wisdomprompt.com/api/{relative_path}")
                else:
                    print(f"Failed to download the image from {img_url}, status code: {img_response.status_code}")
            except Exception as e:
                print(f"Error processing image data: {e}")
    else:
        # Debugging: Log a message when no data is found
        print("No image data found in the response!")
        print("Full API response for debugging:", response)

    # Return the list of saved image URLs
    return saved_files
