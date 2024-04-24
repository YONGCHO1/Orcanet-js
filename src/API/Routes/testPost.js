// Define the URL and request body
const url = 'http://localhost:50337/remove-peer';
const data = { 'peer-id': '12D3KooWQyw3QUx6pUHDmvvjqCPqGyiz7hLGEByby7Bj2n2idYE7' };

// Define request options
const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json' // Specify the content type as JSON
  },
  body: JSON.stringify(data) // Convert the data object to a JSON string
};

// Send the POST request
fetch(url, options)
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.text(); // Parse the JSON response
  })
  .then(text => {
    console.log('Response:', text); // Handle the response data
  })
  .catch(error => {
    console.error('Error:', error); // Handle errors
  });