(async () => {
  try {
    // 1. Signup a user
    const email = "test" + Date.now() + "@test.com";
    const res1 = await fetch("http://localhost:5001/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test User", email, password: "password" })
    });
    const data1 = await res1.json();
    const token = data1.token;
    const authHeaders = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
    
    // 2. Create a room
    const res2 = await fetch("http://localhost:5001/api/documents", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ title: "Test Room" })
    });
    const data2 = await res2.json();
    const roomCode = data2.roomCode;
    console.log("Created room with code:", roomCode);
    
    // 3. Search for room code
    const res3 = await fetch("http://localhost:5001/api/documents/join", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ roomCode })
    });
    const data3 = await res3.json();
    console.log("Join response:", data3);
  } catch (err) {
    console.error("Error:", err);
  }
})();
