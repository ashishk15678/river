import dynamic from "next/dynamic";

const Dashboard = dynamic(() => import("./dash-comp"), { ssr: false });

// Export the wrapped dashboard component
export default Dashboard;
