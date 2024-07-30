import { initializeKeypair } from "./initializeKeypair";
import { Connection, clusterApiUrl, PublicKey } from "@solana/web3.js";
import {
  Metaplex,
  keypairIdentity,
  bundlrStorage,
  toMetaplexFile,
  NftWithToken,
  Signer,
} from "@metaplex-foundation/js";
import * as fs from "fs";

interface NftData {
  name: string;
  symbol: string;
  description: string;
  sellerFeeBasisPoints: number;
  imageFile: string;
}

// example data for a new NFT
const nftData = {
  name: "Bleach",
  symbol: "BLC",
  description: "ZANGETSU",
  sellerFeeBasisPoints: 0,
  imageFile: "ichigo.jfif",
};

// example data for updating an existing NFT
const updateNftData = {
  name: "Bleach 1000 year blood wat",
  symbol: "BLCBW",
  description: "Bin yıllık kan savaşı",
  sellerFeeBasisPoints: 100,
  imageFile: "kurosaki.jfif",
};

interface CollectionNftData {
  name: string;
  symbol: string;
  description: string;
  sellerFeeBasisPoints: number;
  imageFile: string;
  isCollection: boolean;
  collectionAuthority: Signer;
}

// helper function to upload image and metadata;
async function uploadMetadata(
  metaplex: Metaplex,
  nftData: NftData
): Promise<string> {
  // file to buffer - ara belleğe alınacak dosya
  const buffer = fs.readFileSync("src/" + nftData.imageFile);

  // buffer to metaplex file  -
  // metaplex dosyasına arabellek

  const file = toMetaplexFile(buffer, nftData.imageFile);

  // upload image anf get imagee uri

  const imageUri = await metaplex.storage().upload(file);
  console.log("image uri:", imageUri);

  //upload metaadata ana get metadata uri (off chain metadata)
  const { uri } = await metaplex.nfts().uploadMetadata({
    name: nftData.name,
    symbol: nftData.symbol,
    description: nftData.description,
    image: imageUri,
  });

  console.log("metada uri", uri);
  return uri;
}

//helper function create NFT

async function createNft(
  metaplex: Metaplex,
  uri: string,
  nftData: NftData,
  collectionMint: PublicKey
): Promise<NftWithToken> {
  const { nft } = await metaplex.nfts().create(
    {
      uri: uri, //metadata uri
      name: nftData.name,
      sellerFeeBasisPoints: nftData.sellerFeeBasisPoints,
      symbol: nftData.symbol,
      collection: collectionMint,
    },
    { commitment: "finalized" }
  );
  console.log(
    `Token Mint: https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`
  );

  //this is what verifies our collection as a certified collection
  await metaplex.nfts().verifyCollection({
    mintAddress: nft.mint.address,
    collectionMintAddress: collectionMint,
    isSizedCollection: true,
  });
  return nft;
}

async function updateNftUri(
  metaplex: Metaplex,
  uri: string,
  mintAddress: PublicKey,
  updateData: NftData
) {
  // Fetch NFT data using mint address
  const nft = await metaplex.nfts().findByMint({ mintAddress });

  // Update the NFT metadata
  const { response } = await metaplex.nfts().update(
    {
      nftOrSft: nft,
      uri: uri,
      name: updateData.name,
      symbol: updateData.symbol,
      sellerFeeBasisPoints: updateData.sellerFeeBasisPoints,
    },
    { commitment: "finalized" }
  );

  console.log(
    `Token Mint: https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`
  );

  console.log(
    `Transaction: https://explorer.solana.com/tx/${response.signature}?cluster=devnet`
  );
}

async function createCollectionNft(
  metaplex: Metaplex,
  uri: string,
  data: CollectionNftData
): Promise<NftWithToken> {
  const { nft } = await metaplex.nfts().create(
    {
      uri: uri,
      name: data.name,
      sellerFeeBasisPoints: data.sellerFeeBasisPoints,
      symbol: data.symbol,
      isCollection: true,
    },
    { commitment: "finalized" }
  );

  console.log(
    `Collection Mint: https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`
  );

  return nft;
}

async function main() {
  // create a new connection to the cluster's API
  const connection = new Connection(clusterApiUrl("devnet"));

  // initialize a keypair for the user
  const user = await initializeKeypair(connection);

  console.log("PublicKey:", user.publicKey.toBase58());

  //  metplex set up
  const metaplex = Metaplex.make(connection)
    .use(keypairIdentity(user))
    .use(
      bundlrStorage({
        address: "https://devnet.bundlr.network",
        providerUrl: "https://api.devnet.solana.com",
        timeout: 6000,
      })
    );

  const collectionNftData = {
    name: "Bleach",
    symbol: "BLC",
    description: "İchigo yağmurdan nefret ederim",
    sellerFeeBasisPoints: 100,
    imageFile: "kurich.jfif",
    isCollection: true,
    collectionAuthority: user,
  };

  // upload data for the collection NFT and get the URI for the metadata
  const collectionUri = await uploadMetadata(metaplex, collectionNftData);

  // create a collection NFT using the helper function and the URI from the metadata

  const collectionNft = await createCollectionNft(
    metaplex,
    collectionUri,
    collectionNftData
  );

  // upload the nft data and get the uri for the metadata
  const uri = await uploadMetadata(metaplex, nftData);

  //create on NFT using the helper function and the Urı from the metadata
  const nft = await createNft(
    metaplex,
    uri,
    nftData,
    collectionNft.mint.address
  );

  //upload updated nft data and get the new URI for the metadata
  const updatedUri = await uploadMetadata(metaplex, updateNftData);

  //update the Nft using the helper function and the new URI from the metadata
  await updateNftUri(metaplex, updatedUri, nft.address, updateNftData);
}

main()
  .then(() => {
    console.log("Finished successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
